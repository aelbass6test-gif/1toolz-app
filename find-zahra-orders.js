import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";

async function run() {
  try {
    let ordersSnap = await getDocs(query(collection(db, 'orders'), where('storeId', '==', storeId)));
    if (ordersSnap.empty) {
      ordersSnap = await getDocs(query(collection(db, 'orders'), where('store_id', '==', storeId)));
    }

    console.log(`Found ${ordersSnap.size} orders for store ${storeId}`);
    const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log("\n--- ORDERS LIST ---");
    orders.forEach(o => {
      // Look for Zahra or cashHolder or advance payment details
      const isZahraInCashHolder = o.cashHolderId && o.cashHolderId.includes("1780157998978"); // Zahra's partner ID is "1780157998978"
      const isZahraInAdvance = o.advancePaymentHolderId && o.advancePaymentHolderId.includes("1780157998978");
      
      // Let's also check if cashHolderName or advancePaymentHolderName is Zahra
      const isZahraName = (o.cashHolderName && (o.cashHolderName.includes("زهره") || o.cashHolderName.includes("زهرة"))) ||
                          (o.advancePaymentHolderName && (o.advancePaymentHolderName.includes("زهره") || o.advancePaymentHolderName.includes("زهرة")));

      if (isZahraInCashHolder || isZahraInAdvance || isZahraName) {
        console.log(`Order #: ${o.orderNumber || o.id}, Status: ${o.status}, Channel: ${o.channel}, Company: ${o.shippingCompany}`);
        console.log(`  Customer: ${o.customerName}, productPrice: ${o.productPrice}, shippingFee: ${o.shippingFee}, discount: ${o.discount}`);
        console.log(`  cashHolderId: ${o.cashHolderId}, cashHolderName: ${o.cashHolderName}`);
        console.log(`  advancePayment: ${o.advancePayment}, advancePaymentHolderId: ${o.advancePaymentHolderId}, advancePaymentHolderName: ${o.advancePaymentHolderName}`);
        console.log(`  createdDate/Time: ${o.createdDate || o.createdAt}`);
      }
    });

  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

run();
