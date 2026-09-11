import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    console.log("Searching stores_data...");
    const storesSnapshot = await getDocs(collection(db, 'stores_data'));
    let found = false;
    for (let storeDoc of storesSnapshot.docs) {
        const storeData = storeDoc.data();
        const orders = storeData.orders || [];
        console.log(`Store doc: ${storeDoc.id}, Name: ${storeData.name}, Orders count: ${orders.length}`);
        for (let ord of orders) {
            const numStr = String(ord.orderNumber || ord.order_number || '');
            const phoneStr = String(ord.customerPhone || ord.customer_phone || ord.phone || '');
            if (numStr.includes("238") || phoneStr.includes("64527923")) {
                console.log(`[MATCH stores_data] Store: ${storeDoc.id}`);
                console.log(`Order: ID=${ord.id}, Num=${ord.orderNumber}, Status=${ord.status}, Phone=${ord.customerPhone || ord.phone}, Name=${ord.customerName || ord.customer_name}`);
                console.log(`Notes:`, ord.notes);
                found = true;
            }
        }
    }

    console.log("Searching standalone orders...");
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    console.log(`Standalone orders count: ${ordersSnapshot.docs.length}`);
    for (let ordDoc of ordersSnapshot.docs) {
        const ord = ordDoc.data();
        const numStr = String(ord.orderNumber || ord.order_number || '');
        const phoneStr = String(ord.customerPhone || ord.customer_phone || ord.phone || '');
        if (numStr.includes("238") || phoneStr.includes("64527923") || ordDoc.id.includes("238")) {
            console.log(`[MATCH standalone orders] Doc ID: ${ordDoc.id}`);
            console.log(`Order: ID=${ord.id}, Num=${ord.orderNumber}, Status=${ord.status}, Phone=${ord.customerPhone || ord.phone}, Name=${ord.customerName || ord.customer_name}`);
            console.log(`Notes:`, ord.notes);
            found = true;
        }
    }

    if (!found) {
        console.log("No match found for 238 or 64527923 anywhere.");
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
