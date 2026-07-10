const fs = require('fs');
let content = fs.readFileSync('components/ReportsPage.tsx', 'utf8');

const combinedTransactionsCode = `const combinedTransactions = useMemo(() => {
        const walletTxs = wallet?.transactions || [];
        const treasuryTxs = (treasury?.transactions || []).map((t: any) => ({
            id: t.id,
            type: t.type === 'withdrawal' ? 'سحب' : t.type === 'deposit' ? 'إيداع' : t.type,
            amount: t.amount,
            date: t.date,
            note: t.description,
            category: t.category,
            status: 'completed',
            details: t.fromAccountId ? { accountId: t.fromAccountId } : undefined
        } as any));
        return [...walletTxs, ...treasuryTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [wallet?.transactions, treasury?.transactions]);`;

// Insert the combined array near the top of the component
content = content.replace("export const ReportsPage: React.FC<ReportsPageProps> = ({ orders, settings, wallet, treasury }) => {", "export const ReportsPage: React.FC<ReportsPageProps> = ({ orders, settings, wallet, treasury }) => {\n" + combinedTransactionsCode);

// Now replace all `(wallet?.transactions || [])` with `combinedTransactions` in ReportsPage.tsx
content = content.replaceAll("(wallet?.transactions || [])", "combinedTransactions");

// Add treasury to dependency arrays if needed, but the hooks already depend on `wallet` or `wallet?.transactions`, and the new ones depend on combinedTransactions. 
// Actually, `useMemo` hooks might need `combinedTransactions` instead of `wallet.transactions` or `wallet?.transactions`.
content = content.replaceAll("wallet?.transactions", "combinedTransactions");
content = content.replaceAll("wallet.transactions", "combinedTransactions");

fs.writeFileSync('components/ReportsPage.tsx', content);
