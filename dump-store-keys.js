import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    const storeId = "store-1771165841517-fkrbaec";
    const snap = await getDoc(doc(db, "stores_data", storeId));
    if (snap.exists()) {
        const data = snap.data();
        console.log(`Keys of ${storeId}:`, Object.keys(data));
        console.log(`settings keys:`, Object.keys(data.settings || {}));
        console.log(`orders is array:`, Array.isArray(data.orders));
        if (data.orders) {
            console.log(`orders length:`, data.orders.length);
            if (data.orders.length > 0) {
                console.log(`sample order:`, data.orders[0]);
            }
        }
    } else {
        console.log("Store document does not exist!");
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
