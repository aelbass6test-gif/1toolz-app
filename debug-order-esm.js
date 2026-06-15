
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const ordersRef = collection(db, 'orders');
    const q1 = query(ordersRef, where('orderNumber', '==', '1'));
    const snap1 = await getDocs(q1);
    
    if (snap1.empty) {
      console.log('No order #1 (string) found');
      const q2 = query(ordersRef, where('orderNumber', '==', 1));
      const snap2 = await getDocs(q2);
      if (snap2.empty) {
          console.log('No order #1 (number) found');
          const q3 = query(ordersRef, where('order_number', '==', '1'));
          const snap3 = await getDocs(q3);
          if (!snap3.empty) {
            snap3.forEach(doc => console.log('Order Data (order_number):', JSON.stringify(doc.data(), null, 2)));
          }
      } else {
        snap2.forEach(doc => console.log('Order Data (number):', JSON.stringify(doc.data(), null, 2)));
      }
    } else {
      snap1.forEach(doc => console.log('Order Data (string):', JSON.stringify(doc.data(), null, 2)));
    }

    const settingsRef = collection(db, 'settings');
    const settingsSnap = await getDocs(settingsRef);
    settingsSnap.forEach(doc => {
      const data = doc.data();
      if (data.wallet && data.wallet.transactions) {
        const related = data.wallet.transactions.filter(t => 
             (t.note && t.note.includes('#1')) || 
             t.orderNumber === '1' || 
             t.orderNumber === 1 ||
             (t.id && t.id.includes('_1'))
        );
        if (related.length > 0) {
          console.log('Related Transactions:', JSON.stringify(related, null, 2));
        }
      }
    });

  } catch (err) {
    console.error("Error:", err);
  }
}
run();
