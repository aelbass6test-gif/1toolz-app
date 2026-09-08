import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    console.log("Listing all orders in the 'orders' collection...");
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    console.log(`Total orders found: ${ordersSnapshot.size}`);
    ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`Doc ID: ${doc.id}`);
        console.log(`  orderNumber: ${data.orderNumber || data.order_number}`);
        console.log(`  customerName: ${data.customerName || data.customer_name}`);
        console.log(`  customerPhone: ${data.customerPhone || data.customer_phone || data.phone}`);
        console.log(`  status: ${data.status}`);
        console.log(`  storeId: ${data.storeId}`);
        console.log(`  createdAt: ${data.createdAt || data.date}`);
    });
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
