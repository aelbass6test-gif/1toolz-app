import re

with open('components/ExpensesPage.tsx', 'r') as f:
    content = f.read()

live_balance_str = """
  const liveBalance = useMemo(() => {
    return (wallet.transactions || []).reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        if (t.category === 'supply_purchase' || t.category === 'supply_deposit' || t.category?.startsWith('supply_expense_')) return sum;
        if (t.details?.paidByPartnerId || t.details?.expensePaidBy || t.note?.includes('دفعهم') || t.note?.includes('شريك')) return sum;
        if (t.type === 'إيداع') return t.status === 'completed' ? sum + amount : sum;
        if (t.type === 'سحب') return t.status === 'cancelled' ? sum : sum - amount;
        return sum;
    }, 0);
  }, [wallet.transactions]);

  const expenses"""

content = content.replace("  const expenses", live_balance_str, 1)

# Now, replace matchesPartner
old_matches_partner = """        const matchesPartner = filterPartner === 'all' || 
            (exp.details?.paidByPartnerId === filterPartner) ||
            (exp.note.includes(settings.partners?.find(p => p.id === filterPartner)?.name || '___NEVER_MATCH___'));"""
            
new_matches_partner = """        const matchesPartner = filterPartner === 'all' || 
            (exp.details?.paidByPartnerId === filterPartner) ||
            (exp.note.includes(settings.partners?.find(p => p.id === filterPartner)?.name || '___NEVER_MATCH___')) ||
            (exp.details?.expensePaidBy?.includes(settings.partners?.find(p => p.id === filterPartner)?.name || '___NEVER_MATCH___'));"""

content = content.replace(old_matches_partner, new_matches_partner)

# Now replace the return of filteredExpenses
old_return = """        return matchesCategory && matchesPartner && matchesAccount && matchesPeriod && matchesSearch;
    });
  }, [expenses, filterCategory, filterPartner, filterAccount, filterPeriod, searchQuery, settings.partners, treasury?.accounts]);"""

new_return = """        return matchesCategory && matchesPartner && matchesAccount && matchesPeriod && matchesSearch;
    }).map(exp => {
        if (filterPartner !== 'all') {
            const partnerName = settings.partners?.find(p => p.id === filterPartner)?.name;
            if (partnerName) {
                const text = exp.details?.expensePaidBy || exp.note;
                const regex = new RegExp(`(\\\\d+(?:\\\\.\\\\d+)?)\\\\s*دفعهم\\\\s*${partnerName}`, 'i');
                const match = text.match(regex);
                if (match && parseFloat(match[1]) > 0) {
                    return { ...exp, amount: parseFloat(match[1]) };
                }
            }
        }
        return exp;
    });
  }, [expenses, filterCategory, filterPartner, filterAccount, filterPeriod, searchQuery, settings.partners, treasury?.accounts]);"""

content = content.replace(old_return, new_return)

with open('components/ExpensesPage.tsx', 'w') as f:
    f.write(content)

