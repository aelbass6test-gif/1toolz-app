const normalizeId = (id) => id ? String(id).trim() : null;

const settings = {
    inventoryAudits: [
        {
            date: "2026-08-19T08:00:00Z",
            discrepancies: [
                { productId: "prod1", actualQty: 12 }
            ]
        }
    ],
    supplyOrders: [
        {
            date: "2026-08-18T08:00:00Z",
            status: "completed",
            items: [
                { productId: "prod1", quantity: 14 }
            ]
        }
    ],
    products: [
        { id: "prod1", hasVariants: false }
    ]
};

const rawPMap = {};
const auditTimePMap = {};

settings.inventoryAudits.forEach(audit => {
    const auditTime = new Date(audit.date).getTime();
    audit.discrepancies.forEach(d => {
        rawPMap[normalizeId(d.productId)] = d.actualQty;
        auditTimePMap[normalizeId(d.productId)] = auditTime;
    });
});

const isAfterAudit = (pId, txDate) => {
    const txTime = new Date(txDate).getTime();
    if (pId && auditTimePMap[pId] !== undefined) {
        return txTime > auditTimePMap[pId];
    }
    return true;
};

settings.supplyOrders.forEach(order => {
    if (order.status !== 'completed') return;
    order.items.forEach(item => {
        const pId = normalizeId(item.productId);
        if (!isAfterAudit(pId, order.date)) return;
        rawPMap[pId] = (rawPMap[pId] || 0) + item.quantity;
    });
});

console.log("Result:", rawPMap);
