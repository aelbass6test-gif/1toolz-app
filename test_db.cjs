const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(fs.readFileSync('firebase-applet-config.json'));
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

async function run() {
    const storesSnapshot = await db.collection('stores').get();
    for (let doc of storesSnapshot.docs) {
        const settings = doc.data().settings || {};
        if (settings.inventoryAudits) {
            console.log("Store:", doc.id);
            console.log("Audits:", settings.inventoryAudits.length);
            const latestAudit = settings.inventoryAudits[0];
            console.log("Latest Audit date:", latestAudit.date);
            console.log("Discrepancies:", JSON.stringify(latestAudit.discrepancies, null, 2));
        }
    }
}
run().catch(console.error);
