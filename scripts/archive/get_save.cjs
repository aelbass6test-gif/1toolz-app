const fs = require('fs');
const content = fs.readFileSync('components/audit/ActiveSessionWorksheet.tsx', 'utf8');
const lines = content.split('\n');
let start = lines.findIndex(l => l.includes('const handleSaveAndApply'));
let logStr = lines.slice(start, start + 80).join('\n');
console.log(logStr);
