const fs = require('fs');
const content = fs.readFileSync('components/InventoryAudit.tsx', 'utf8');
const lines = content.split('\n');
let start = lines.findIndex(l => l.includes('const handleApproveSharedAudit'));
let logStr = lines.slice(start, start + 60).join('\n');
console.log(logStr);
