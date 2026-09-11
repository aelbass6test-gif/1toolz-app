const fs = require('fs');
const content = fs.readFileSync('components/ProductsPage.tsx', 'utf8');

const targetStr = `        // Sort ascending by time so latest audit overwrites earlier ones
        const sortedAudits = [...settings.inventoryAudits].sort((a, b) => {
            const timeA = a.timestamp || new Date(a.date).getTime();
            const timeB = b.timestamp || new Date(b.date).getTime();
            return timeA - timeB;
        });`;

const replaceStr = `        // Sort ascending by time so latest audit overwrites earlier ones
        const sortedAudits = [...settings.inventoryAudits].sort((a, b) => {
            let timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
            let timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
            if (isNaN(timeA)) timeA = 0;
            if (isNaN(timeB)) timeB = 0;
            return timeA - timeB;
        });`;

if (content.includes(targetStr)) {
    fs.writeFileSync('components/ProductsPage.tsx', content.replace(targetStr, replaceStr));
    console.log("Sorted audits logic patched.");
} else {
    console.log("Target string not found.");
}
