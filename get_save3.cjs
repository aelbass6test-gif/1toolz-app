const fs = require('fs');
const content = fs.readFileSync('components/InventoryAudit.tsx', 'utf8');
const lines = content.split('\n');
let start = lines.findIndex(l => l.includes('discrepancies.push('));
let logStr = lines.slice(start - 20, start + 20).join('\n');
console.log(logStr);
