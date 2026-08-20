const fs = require('fs');
const content = fs.readFileSync('components/InventoryAudit.tsx', 'utf8');
const lines = content.split('\n');
let start = lines.findIndex(l => l.includes('const handleApproveSharedAudit'));
let end = lines.findIndex((l, i) => i > start && l.includes('setSettings(prev => ({'));
let logStr = lines.slice(end, end + 30).join('\n');
console.log(logStr);
