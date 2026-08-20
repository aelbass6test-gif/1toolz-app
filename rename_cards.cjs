const fs = require('fs');

function replaceInFile(path, target, replacement) {
    let content = fs.readFileSync(path, 'utf8');
    if (content.includes(target)) {
        content = content.replaceAll(target, replacement);
        fs.writeFileSync(path, content);
        console.log(`Replaced in ${path}: ${target} -> ${replacement}`);
    }
}

replaceInFile('components/PartnerStatementModal.tsx', 'الربح غير الموزع', 'الأرباح المستحقة');
replaceInFile('components/PartnerStatementModal.tsx', 'العهد المسواة', 'تسويات العهد');

replaceInFile('components/ReportsPage.tsx', 'الأرباح غير الموزعة', 'الأرباح المستحقة (غير الموزعة)');
replaceInFile('components/ReportsPage.tsx', 'العهد المسواة', 'تسويات العهد');
