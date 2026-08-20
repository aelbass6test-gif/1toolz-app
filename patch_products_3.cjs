const fs = require('fs');

const path = 'components/ProductsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = `                if (pId) {
                    if (vId) {
                        rawVMap[vId] = d.actualQty;
                        auditTimeVMap[vId] = auditTime;
                    } else {
                        rawPMap[pId] = d.actualQty;
                        auditTimePMap[pId] = auditTime;
                    }
                }`;

const replacement1 = `                if (pId) {
                    if (vId) {
                        rawVMap[vId] = d.actualQty;
                        auditTimeVMap[vId] = auditTime;
                    } else {
                        rawPMap[pId] = d.actualQty;
                    }
                    // Always set parent audit time to the latest known audit of any variant
                    if (auditTimePMap[pId] === undefined || auditTime > auditTimePMap[pId]) {
                        auditTimePMap[pId] = auditTime;
                    }
                }`;

if (content.includes(target1)) {
    content = content.replace(target1, replacement1);
    console.log("Patched target 1 (auditTimePMap logic)");
} else {
    console.log("Target 1 not found");
}

const target2 = `    Object.keys(rawPMap).forEach(pId => {
        const prQty = prPMap[pId] || 0;`;

const replacement2 = `    // If a product has variants in rawVMap but the product currently has NO variants, pull the stock UP to the parent
    Object.keys(rawVMap).forEach(vId => {
        const pId = variantToProductMap[vId];
        if (pId && !productHasVariantsMap[pId]) {
            rawPMap[pId] = (rawPMap[pId] || 0) + rawVMap[vId];
            rawVMap[vId] = 0; // consumed
        }
    });

    Object.keys(rawPMap).forEach(pId => {
        const prQty = prPMap[pId] || 0;`;

if (content.includes(target2)) {
    content = content.replace(target2, replacement2);
    console.log("Patched target 2 (pull variant stock up)");
} else {
    console.log("Target 2 not found");
}

fs.writeFileSync(path, content);
