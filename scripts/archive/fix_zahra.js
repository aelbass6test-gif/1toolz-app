import fs from 'fs';
let content = fs.readFileSync('components/Dashboard.tsx', 'utf8');

const targetContent = `        let custodyAmt = Math.max(holderSum, Math.abs(handoverSum), handoverSum);
        if (custodyAmt <= 0 && holderSum !== 0) custodyAmt = holderSum;

        const settlements = userHandovers.filter(h => h.toUserId === 'admin_deduction' || (h.toUserName && h.toUserName.includes('خصم')));
        const hasSettlement = settlements.length > 0;

        if (normalizeName(user.name).includes('زهره')) {
            if (!hasSettlement) {
                if (custodyAmt <= 0) custodyAmt = 7275;
            } else {
                const lastSettlementDate = settlements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date;
                const activeHandovers = userHandovers.filter(h => new Date(h.date).getTime() > new Date(lastSettlementDate).getTime());
                const activeHandoverSum = activeHandovers.reduce((sum_act, h_act) => {
                    const isGive_act = userUserIds.includes(h_act.toUserId) || h_act.toUserId === user.id || h_act.toUserId === holderId || normalizeName(h_act.toUserName || '').includes(normalizeName(user.name));
                    return isGive_act ? sum_act + (Number(h_act.amount) || 0) : sum_act - (Number(h_act.amount) || 0);
                }, 0);
                custodyAmt = Math.max(0, activeHandoverSum);
            }
        }

        const name = normalizeName(user.name);
        if (!grouped[name] && custodyAmt > 0) {
            grouped[name] = {
                userId: holderId,
                userName: user.name,
                currentBalance: custodyAmt,
                lastUpdated: new Date().toISOString(),
                originalIds: [holderId, user.id]
            };
        } else if (grouped[name]) {
            if (custodyAmt > grouped[name].currentBalance) {
                grouped[name].currentBalance = custodyAmt;
            }
        } else if (normalizeName(user.name).includes('زهره')) {
            grouped[name] = {
                userId: holderId,
                userName: user.name,
                currentBalance: hasSettlement ? custodyAmt : 7275,
                lastUpdated: new Date().toISOString(),
                originalIds: [holderId, user.id]
            };
        }
    });

    return Object.values(grouped);
  }, [settings?.cashHolders, settings?.partners, settings?.employees, orders, treasury]);`;

const replacement = `        let custodyAmt = Math.max(holderSum, Math.abs(handoverSum), handoverSum);
        if (custodyAmt <= 0 && holderSum !== 0) custodyAmt = holderSum;

        const settlements = userHandovers.filter(h => h.toUserId === 'admin_deduction' || (h.toUserName && h.toUserName.includes('خصم')));
        const hasSettlement = settlements.length > 0;

        const name = normalizeName(user.name);
        if (!grouped[name] && custodyAmt > 0) {
            grouped[name] = {
                userId: holderId,
                userName: user.name,
                currentBalance: custodyAmt,
                lastUpdated: new Date().toISOString(),
                originalIds: [holderId, user.id]
            };
        } else if (grouped[name]) {
            if (custodyAmt > grouped[name].currentBalance) {
                grouped[name].currentBalance = custodyAmt;
            }
        }
    });

    return Object.values(grouped);
  }, [settings?.cashHolders, settings?.partners, settings?.employees, orders, treasury]);`;

if (content.includes("if (normalizeName(user.name).includes('زهره'))")) {
    content = content.replace(targetContent, replacement);
    fs.writeFileSync('components/Dashboard.tsx', content, 'utf8');
    console.log("Successfully replaced target content in Dashboard.tsx");
} else {
    console.log("Could not find the target string.");
}
