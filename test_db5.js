import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    for (let doc of usersSnap.docs) {
        const u = doc.data();
        if (u.stores && u.stores.length > 0) {
            for (let store of u.stores) {
                const audits = store.settings?.inventoryAudits || [];
                if (audits.length > 0) {
                    console.log(`User ${doc.id}, Store ${store.id}: ${audits.length} audits`);
                    const latest = audits[0];
                    const hasDrill = latest.discrepancies?.find(d => d.name.includes('إكس بي ماكس') || d.name.includes('باور 12'));
                    console.log(`Latest audit: ${latest.id}, discrepancies: ${latest.discrepancies?.length}, hasDrill: ${hasDrill ? 'YES' : 'NO'}`);
                }
            }
        }
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
