const fs = require('fs');
const content = fs.readFileSync('components/ProductsPage.tsx', 'utf8');
const lines = content.split('\n');
let start = lines.findIndex(l => l.includes('const sortedAudits'));
let logStr = lines.slice(start - 5, start + 35).join('\n');
console.log(logStr);
