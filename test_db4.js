import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    const storesRef = collection(db, 'stores_data');
    const storesSnapshot = await getDocs(storesRef);
    console.log(`Found ${storesSnapshot.docs.length} stores`);
    for (let doc of storesSnapshot.docs) {
        const settings = doc.data().settings || {};
        const audits = settings.inventoryAudits || [];
        console.log(`Store ${doc.id}: ${audits.length} audits`);
        if (audits.length > 0) {
            const latest = audits[0];
            const hasDrill = latest.discrepancies?.find(d => d.name.includes('إكس بي ماكس') || d.name.includes('باور 12'));
            console.log(`Latest audit: ${latest.id}, discrepancies count: ${latest.discrepancies?.length}, hasDrill: ${hasDrill ? 'YES' : 'NO'}`);
        }
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
