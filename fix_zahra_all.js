import fs from 'fs';

const filesToFix = [
    'components/AccountingReports.tsx',
    'components/TreasuryPage.tsx',
    'components/PartnerStatementModal.tsx',
    'components/CashManagement.tsx',
    'components/PartnersPage.tsx',
    'components/PartnerProfilePage.tsx'
];

for (let file of filesToFix) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Simple block remover function
    // We'll just remove the if block based on known starting string and brace counting
    let startIdx = 0;
    while(true) {
        let matchStr = null;
        let indexZahra = content.indexOf("includes('زهره')", startIdx);
        if(indexZahra === -1) break;
        
        // Find the beginning of the `if` statement for this index
        let ifIndex = content.lastIndexOf("if (", indexZahra);
        if (ifIndex === -1) {
            startIdx = indexZahra + 1;
            continue;
        }
        
        let braceStart = content.indexOf("{", indexZahra);
        if (braceStart === -1) {
            startIdx = indexZahra + 1;
            continue;
        }
        
        let braceCount = 1;
        let braceEnd = -1;
        for (let i = braceStart + 1; i < content.length; i++) {
            if (content[i] === "{") braceCount++;
            else if (content[i] === "}") braceCount--;
            
            if (braceCount === 0) {
                braceEnd = i;
                break;
            }
        }
        
        if (braceEnd !== -1) {
            // Also check for `else if` before it to remove the `else` as well
            let beforeIf = content.substring(Math.max(0, ifIndex - 15), ifIndex).trim();
            if (beforeIf.endsWith("else")) {
                ifIndex = content.lastIndexOf("else", ifIndex);
            }
            
            console.log(`Found block in ${file} from ${ifIndex} to ${braceEnd}`);
            content = content.substring(0, ifIndex) + content.substring(braceEnd + 1);
            // Don't update startIdx, search from beginning as content length changed
            startIdx = 0;
        } else {
            startIdx = indexZahra + 1;
        }
    }
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Cleaned ${file}`);
}
