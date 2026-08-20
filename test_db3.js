import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    const docRef = doc(db, 'shared_audits', 'sa-1787146361052');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`Status: ${data.status}`);
        console.log(`Total items: ${data.items?.length}`);
        const drill1 = data.items?.find(i => i.name.includes('إكس بي ماكس') || i.actualQty === 12 || i.actualQty === 14);
        const drill2 = data.items?.find(i => i.name.includes('باور 12 فولت') || i.actualQty === 6 || i.actualQty === 4);
        console.log(`Drill 1: ${drill1 ? JSON.stringify(drill1) : 'Not found'}`);
        console.log(`Drill 2: ${drill2 ? JSON.stringify(drill2) : 'Not found'}`);
    } else {
        console.log("No such document!");
    }
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
