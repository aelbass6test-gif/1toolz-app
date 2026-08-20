import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function run() {
    // Try to find the user document that contains this store
    const { getDocs, collection } = await import("firebase/firestore");
    const usersSnap = await getDocs(collection(db, 'users'));
    let settings = null;
    for (let uDoc of usersSnap.docs) {
        const u = uDoc.data();
        if (u.stores) {
            for (let s of u.stores) {
                if (s.settings && s.settings.products?.some(p => p.id === 'imported-1780157554081-24')) {
                    settings = s.settings;
                    break;
                }
            }
        }
    }
    
    if (!settings) {
        console.log("Could not find the store settings with the drill product.");
        process.exit(1);
    }
    
    console.log("Found settings! Products:", settings.products.length, "Audits:", settings.inventoryAudits?.length);

    // Now run the exact logic
    const normalizeId = (id) => id ? String(id).trim() : null;

    const rawPMap = {};
    const rawVMap = {};
    const soReturnedPMap = {};
    const soReturnedVMap = {};
    const auditTimePMap = {};
    const auditTimeVMap = {};
    const variantToProductMap = {};
    const historicalVariantToProductMap = {};
    const productHasVariantsMap = {};
    const productVariantsListMap = {};

    (settings.products || []).forEach(p => {
        const pId = String(p.id).trim();
        productHasVariantsMap[pId] = !!(p.hasVariants && p.variants && p.variants.length > 0);
        if (p.hasVariants && p.variants) {
            productVariantsListMap[pId] = [];
            p.variants.forEach(v => {
                const vId = String(v.id).trim();
                variantToProductMap[vId] = pId;
                productVariantsListMap[pId].push(vId);
            });
        }
    });

    if (settings.inventoryAudits) {
        const sortedAudits = [...settings.inventoryAudits].sort((a, b) => {
            let timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
            let timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
            if (isNaN(timeA)) timeA = 0;
            if (isNaN(timeB)) timeB = 0;
            return timeA - timeB;
        });

        sortedAudits.forEach(audit => {
            const auditTime = audit.timestamp || new Date(audit.date).getTime();
            audit.discrepancies?.forEach(d => {
                const pId = normalizeId(d.productId);
                const vId = normalizeId(d.variantId);
                
                if (pId === 'imported-1780157554081-24') {
                    console.log(`[AUDIT] Found drill! auditTime: ${auditTime}, date: ${audit.date}, actualQty: ${d.actualQty}, vId: ${vId}`);
                }

                if (pId) {
                    if (vId) {
                        historicalVariantToProductMap[vId] = pId;
                        rawVMap[vId] = d.actualQty;
                        auditTimeVMap[vId] = auditTime;
                    } else {
                        rawPMap[pId] = d.actualQty;
                    }
                    if (auditTimePMap[pId] === undefined || auditTime > auditTimePMap[pId]) {
                        auditTimePMap[pId] = auditTime;
                    }
                }
            });
        });
    }

    const isAfterAudit = (pId, vId, txDate) => {
        let txTime = new Date(txDate).getTime();
        // simulate standard date fix if needed
        if (isNaN(txTime) && txDate && txDate.includes('/')) {
             const parts = txDate.split('/');
             if(parts.length === 3) {
                 txTime = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
             }
        }

        if (vId && auditTimeVMap[vId] !== undefined) {
            return txTime > auditTimeVMap[vId];
        }
        if (pId && auditTimePMap[pId] !== undefined) {
            return txTime > auditTimePMap[pId];
        }
        return true;
    };

    console.log(`Initial rawPMap: ${rawPMap['imported-1780157554081-24']}`);

    (settings.supplyOrders || []).forEach(order => {
        if (order.status !== 'completed') return;
        order.items.forEach(item => {
            const pId = normalizeId(item.productId);
            const vId = normalizeId(item.variantId);
            
            if (pId === 'imported-1780157554081-24') {
                const after = isAfterAudit(pId, vId, order.date);
                console.log(`[SUPPLY] Drill order date: ${order.date}, isAfterAudit: ${after}, qty: ${item.quantity}`);
            }

            if (!isAfterAudit(pId, vId, order.date)) return;

            const qty = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
                        ? Number(item.receivedQuantity) 
                        : Number(item.quantity);
            const freeQty = Number(item.freeQuantity) || 0;
            const totalQty = qty + freeQty;

            if (pId) {
                if (vId) {
                    rawVMap[vId] = (rawVMap[vId] || 0) + totalQty;
                } else {
                    if (item.isReturn) {
                        rawPMap[pId] = (rawPMap[pId] || 0) - totalQty;
                    } else {
                        rawPMap[pId] = (rawPMap[pId] || 0) + totalQty;
                    }
                }
            }
        });
    });

    console.log(`Final rawPMap for Drill: ${rawPMap['imported-1780157554081-24']}`);
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
