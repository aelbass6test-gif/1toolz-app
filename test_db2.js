import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    const storesSnapshot = await getDocs(collection(db, 'stores'));
    for (let doc of storesSnapshot.docs) {
        const settings = doc.data().settings || {};
        if (settings.inventoryAudits) {
            console.log("Store:", doc.id);
            console.log("Audits:", settings.inventoryAudits.length);
            const latestAudit = settings.inventoryAudits[0];
            console.log("Latest Audit date:", latestAudit.date);
            console.log("Discrepancies length:", latestAudit.discrepancies?.length);
        }
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
