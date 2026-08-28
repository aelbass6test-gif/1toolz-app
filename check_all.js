import fs from 'fs';
const filesToFix = [
    'components/AccountingReports.tsx',
    'components/TreasuryPage.tsx',
    'components/PartnerStatementModal.tsx',
    'components/CashManagement.tsx',
    'components/PartnersPage.tsx',
    'components/PartnerProfilePage.tsx'
];

for (const file of filesToFix) {
    const content = fs.readFileSync(file, 'utf8');
    let round = 0, curly = 0;
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '(') round++;
        if (content[i] === ')') round--;
        if (content[i] === '{') curly++;
        if (content[i] === '}') curly--;
    }
    console.log(`${file} => Round: ${round}, Curly: ${curly}`);
}
