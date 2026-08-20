const fs = require('fs');
const path = 'components/ProductsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `    const isAfterAudit = (pId: string | null, vId: string | null, txDate: string) => {
        const txTime = new Date(txDate).getTime();`;

const replacement = `    const isAfterAudit = (pId: string | null, vId: string | null, txDate: string) => {
        let txTime = new Date(txDate).getTime();
        if (isNaN(txTime) && txDate && txDate.includes('/')) {
             const parts = txDate.split('/');
             if(parts.length === 3) {
                 txTime = new Date(\`\${parts[2]}-\${parts[1]}-\${parts[0]}\`).getTime();
             }
        }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log("Patched date parsing in isAfterAudit");
} else {
    console.log("Target not found");
}
