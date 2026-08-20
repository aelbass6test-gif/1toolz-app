import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    const storesSnapshot = await getDocs(collection(db, 'stores_data'));
    for (let storeDoc of storesSnapshot.docs) {
        const settings = storeDoc.data().settings || {};
        const audits = settings.inventoryAudits || [];
        if (audits.length > 0) {
            console.log(`Store: ${storeDoc.id}`);
            console.log(`Total Audits: ${audits.length}`);
            const latest = audits[0];
            console.log(`Latest Audit Date: ${latest.date}`);
            console.log(`Latest Audit Timestamp: ${latest.timestamp}`);
            console.log(`Discrepancies Count: ${latest.discrepancies?.length || 0}`);
            if (latest.discrepancies?.length > 0) {
                const disc = latest.discrepancies[0];
                console.log(`Sample Discrepancy: pId=${disc.productId}, vId=${disc.variantId}, actualQty=${disc.actualQty}, variance=${disc.variance}`);
            }
        }
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
