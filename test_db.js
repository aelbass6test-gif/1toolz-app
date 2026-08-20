import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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
            const latest = audits.find(a => a.id.includes('audit-') || a.date);
            if (latest) {
                console.log(`Latest Audit Date: ${latest.date}`);
                console.log(`Latest Audit Timestamp: ${latest.timestamp}`);
                const has12 = latest.discrepancies?.find(d => d.actualQty === 12 || d.actualQty === 6);
                if (has12) {
                    console.log(`Found! pId=${has12.productId}, vId=${has12.variantId}, actualQty=${has12.actualQty}, variance=${has12.variance}`);
                } else {
                    console.log(`No 12/6 found in latest audit.`);
                }
            }
        }
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
