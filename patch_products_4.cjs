const fs = require('fs');
const path = 'components/ProductsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = `    // Helper maps to resolve variant IDs to product IDs and check existence
    const variantToProductMap: Record<string, string> = {};`;

const replacement1 = `    // Helper maps to resolve variant IDs to product IDs and check existence
    const variantToProductMap: Record<string, string> = {};
    const historicalVariantToProductMap: Record<string, string> = {}; // Tracks variant-parent relationships from audits and transactions`;

if (content.includes(target1)) {
    content = content.replace(target1, replacement1);
    console.log("Patched target 1");
}

const target2 = `                if (pId) {
                    if (vId) {`;

const replacement2 = `                if (pId) {
                    if (vId) {
                        historicalVariantToProductMap[vId] = pId;`;

if (content.includes(target2)) {
    content = content.replace(target2, replacement2);
    console.log("Patched target 2");
}

const target3 = `        const pId = variantToProductMap[vId];
        if (pId && !productHasVariantsMap[pId]) {`;

const replacement3 = `        const pId = variantToProductMap[vId] || historicalVariantToProductMap[vId];
        if (pId && !productHasVariantsMap[pId]) {`;

if (content.includes(target3)) {
    content = content.replace(target3, replacement3);
    console.log("Patched target 3");
}

fs.writeFileSync(path, content);
