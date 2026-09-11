import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    console.log("Searching stores_data for subcollections...");
    const storesSnapshot = await getDocs(collection(db, 'stores_data'));
    for (let storeDoc of storesSnapshot.docs) {
        console.log(`Checking subcollections of store: ${storeDoc.id}`);
        // Let's try getting docs from subcollection 'orders'
        try {
            const ordersSub = collection(db, 'stores_data', storeDoc.id, 'orders');
            const ordersSnap = await getDocs(ordersSub);
            console.log(`  Subcollection 'orders' size: ${ordersSnap.size}`);
            for (let doc of ordersSnap.docs) {
                const ord = doc.data();
                const numStr = String(ord.orderNumber || ord.order_number || '');
                const phoneStr = String(ord.customerPhone || ord.customer_phone || ord.phone || '');
                if (numStr.includes("238") || phoneStr.includes("64527923") || doc.id.includes("238")) {
                    console.log(`  [MATCHED ORDER IN SUBCOLLECTION] DocId: ${doc.id}`);
                    console.log(`  Data:`, JSON.stringify(ord, null, 2));
                }
            }
        } catch (e) {
            console.log(`  Error reading 'orders' subcol for ${storeDoc.id}:`, e.message);
        }
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
