import fs from 'fs';
let content = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

const errorRegex = /if \(\(settings\.partners \|\| \[\]\)\.length === 1\) return true;\s*\)\);\s*\/\/\s*Combine and sort by date descending/g;

content = content.replace(errorRegex, `if ((settings.partners || []).length === 1) return true;
            }
            return false;
        }).map(o => ({ ...o, _type: 'order_advance' as const }));

        // Combine and sort by date descending`);

fs.writeFileSync('components/AccountingReports.tsx', content, 'utf8');
console.log("Patched syntax error in AccountingReports.tsx");
