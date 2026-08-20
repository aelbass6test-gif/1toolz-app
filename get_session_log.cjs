const fs = require('fs');
const content = fs.readFileSync('components/InventoryAudit.tsx', 'utf8');
const lines = content.split('\n');
let start = lines.findIndex(l => l.includes('const newSessionLog'));
let logStr = lines.slice(start - 20, start + 30).join('\n');
console.log(logStr);
