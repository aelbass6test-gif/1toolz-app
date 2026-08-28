import fs from 'fs';
let content = fs.readFileSync('components/PartnerProfilePage.tsx', 'utf8');

const regex = /const stats = useMemo\(\(\) => \{[\s\S]*?\}, \[transactions, partner, orders\]\);/;

const replacement = `  const stats = useMemo(() => {
    if (!partner) return { totalInvested: 0, totalDividends: 0, totalWithdrawn: 0, totalLoans: 0, totalAdvances: 0, totalRepaid: 0 };
    
    const pOrderAdvances = orders.filter(o => {
        const safeAdvance = Number(o.advancePayment) || 0;
        if (safeAdvance <= 0) return false;
        if (o.advancePaymentTreasuryId || (o.cashHolderId && o.cashHolderId.startsWith('treas_'))) return false;
        const empId = o.advancePaymentEmployeeId || (o.cashHolderId && o.cashHolderId.startsWith('emp_') ? o.cashHolderId.substring(4) : null);
        if (empId) {
            const isPt = (settings.partners || []).some((pt) => String(pt.id) === String(empId));
            if (!isPt) return false;
        }
        if (empId && String(empId) === String(partner.id)) return true;
        if (o.advancePaymentPartnerId === partner.id || o.cashHolderId === \`part_\${partner.id}\`) return true;
        if (Array.isArray(o.advancePaymentHistory) && o.advancePaymentHistory.some((h: any) => h.recipientId === partner.id || (h.recipientType === 'partner' && (h.recipientName === partner.name || h.recipientId === partner.id)))) return true;
        const partnersCount = settings.cashHolders?.filter((h: any) => h.userId.startsWith('part_')).length || 1;
        if (partnersCount === 1) return true;
        return false;
    });

    const advancesSum = pOrderAdvances.reduce((sum, o) => sum + (Number(o.advancePayment) || 0), 0);

    let totalInvested = 0;
    let totalDividends = 0;
    let totalWithdrawn = 0;
    let totalLoans = 0;
    let totalAdvances = advancesSum;
    let totalRepaid = 0;

    transactions.forEach(t => {
        if (t.type === 'capital_addition') totalInvested += t.amount;
        if (t.type === 'profit_distribution') totalDividends += t.amount;
        if (t.type === 'profit_withdrawal') totalWithdrawn += t.amount;
        if (t.type === 'loan') totalLoans += t.amount;
        if (t.type === 'repayment') totalRepaid += t.amount;
    });

    return { totalInvested, totalDividends, totalWithdrawn, totalLoans, totalAdvances, totalRepaid };
  }, [transactions, partner, orders, settings.cashHolders, settings.partners]);`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('components/PartnerProfilePage.tsx', content, 'utf8');
    console.log("Patched stats useMemo!");
} else {
    console.log("Regex didn't match!");
}
