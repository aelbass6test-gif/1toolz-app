const fs = require('fs');
let content = fs.readFileSync('components/ExpensesPage.tsx', 'utf8');
content = content.replace(
  "return wallet.transactions\n        .filter(t => t.type === 'سحب' && t.category && (settings.expenseCategories || []).includes(t.category))\n        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());",
  `const walletExps = wallet.transactions.filter(t => t.type === 'سحب' && t.category && (settings.expenseCategories || []).includes(t.category));
      
      const treasuryExps = (treasury?.transactions || [])
        .filter((t: any) => t.type === 'withdrawal' && t.category && (settings.expenseCategories || []).includes(t.category))
        .map((t: any) => ({
            id: t.id,
            type: 'سحب',
            amount: t.amount,
            date: t.date,
            note: t.description,
            category: t.category,
            status: 'completed',
            details: t.fromAccountId ? { accountId: t.fromAccountId } : undefined
        } as any));

      return [...walletExps, ...treasuryExps].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());`
);
content = content.replace(
  "  }, [wallet.transactions, settings.expenseCategories]);",
  "  }, [wallet.transactions, treasury?.transactions, settings.expenseCategories]);"
);
fs.writeFileSync('components/ExpensesPage.tsx', content);
