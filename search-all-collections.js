import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    const commonCollections = [
        'orders', 'stores_data', 'presence', 'chat_messages', 'maintenance_requests', 'shared_audits', 'users', 'customers'
    ];
    for (const colName of commonCollections) {
        try {
            const colRef = collection(db, colName);
            const snap = await getDocs(colRef);
            console.log(`Collection [${colName}]: docs count = ${snap.size}`);
            if (snap.size > 0) {
                console.log(`  Sample IDs from [${colName}]:`);
                snap.docs.slice(0, 10).forEach(d => {
                    const data = d.data();
                    console.log(`    - ID: ${d.id}, phone: ${data.customerPhone || data.customer_phone || data.phone}, orderNumber: ${data.orderNumber || data.order_number}`);
                });
            }
        } catch (e) {
            console.log(`Error reading collection [${colName}]:`, e.message);
        }
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
