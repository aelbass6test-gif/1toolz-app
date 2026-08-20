const fs = require('fs');
const content = fs.readFileSync('components/InventoryAudit.tsx', 'utf8');
const lines = content.split('\n');
let start = lines.findIndex(l => l.includes('const discrepancies'));
let logStr = lines.slice(start - 5, start + 30).join('\n');
console.log(logStr);
