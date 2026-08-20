const fs = require('fs');
const content = fs.readFileSync('components/audit/ActiveSessionWorksheet.tsx', 'utf8');
const lines = content.split('\n');
let start = lines.findIndex(l => l.includes('const discrepancies: InventoryAuditItemDiscrepancy[] = []'));
let logStr = lines.slice(start - 10, start + 30).join('\n');
console.log(logStr);
