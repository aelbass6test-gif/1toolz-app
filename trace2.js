import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    const { getDocs, collection } = await import("firebase/firestore");
    const usersSnap = await getDocs(collection(db, 'users'));
    let settings = null;
    let drillId = null;
    for (let uDoc of usersSnap.docs) {
        const u = uDoc.data();
        if (u.stores) {
            for (let s of u.stores) {
                const drill = s.settings?.products?.find(p => p.name && p.name.includes('إكس بي ماكس'));
                if (drill) {
                    settings = s.settings;
                    drillId = drill.id;
                    break;
                }
            }
        }
    }
    
    if (!settings) {
        console.log("Could not find drill by name.");
        process.exit(1);
    }
    
    console.log(`Found drill ID: ${drillId}`);

    // Look for audits matching this drill
    const audits = settings.inventoryAudits || [];
    let foundInAudits = false;
    for (let a of audits) {
        const d = a.discrepancies?.find(disc => disc.productId === drillId || disc.name?.includes('إكس بي ماكس'));
        if (d) {
            console.log(`Audit ${a.id} (${a.date}): found actualQty=${d.actualQty}, systemQty=${d.systemQty}, variance=${d.variance}`);
            foundInAudits = true;
        }
    }
    if (!foundInAudits) {
        console.log("Drill not found in ANY audits! This explains why it restores to 14! The audit did not save to the store settings.");
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
