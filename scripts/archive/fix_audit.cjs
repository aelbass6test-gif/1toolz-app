const fs = require('fs');

const path = 'components/audit/ActiveSessionWorksheet.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `                        if (diff !== 0 && countData) {`;
const replacement = `                        // Include items that were explicitly counted, even if variance is 0, to set a baseline timestamp
                        if (countData) {`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log("Patched ActiveSessionWorksheet.tsx");
} else {
    console.log("Target not found in ActiveSessionWorksheet");
}

const path2 = 'components/InventoryAudit.tsx';
let content2 = fs.readFileSync(path2, 'utf8');

const target2 = `                if (diff !== 0) {`;
const replacement2 = `                // Include items that were explicitly counted, even if variance is 0, to set a baseline timestamp
                if (true) {`; // in InventoryAudit, the loop is already over counted items (Object.entries(auditCounts))

if (content2.includes(target2)) {
    content2 = content2.replace(target2, replacement2);
    fs.writeFileSync(path2, content2);
    console.log("Patched InventoryAudit.tsx");
} else {
    console.log("Target not found in InventoryAudit");
}
