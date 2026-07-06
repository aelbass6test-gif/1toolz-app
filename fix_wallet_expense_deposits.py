import re

with open("components/SuppliersPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

target = """                      if (payers.length > 1) {
                          const splitAmount = amount / payers.length;
                          payers.forEach((payer, idx) => {
                              const payerNote = ` - دفع بواسطة: ${payer}`;
                              newWalletTransactions.push({
                                  id: `${baseId}_split${idx}`,
                                  type: 'سحب',
                                  amount: splitAmount,"""

insertion = """                      if (payers.length > 1) {
                          const splitAmount = amount / payers.length;
                          payers.forEach((payer, idx) => {
                              // Deposit from partner
                              newWalletTransactions.push({
                                  id: `${baseId}_fund_${idx}`,
                                  type: 'إيداع',
                                  amount: splitAmount,
                                  date: new Date(date.getTime() + msOffset + idx - 1).toISOString(),
                                  note: `تمويل مصروف من الشريك: ${payer}`,
                                  category: 'supply_deposit',
                                  status: 'completed',
                                  details: { partnerName: payer }
                              } as Transaction);
                              
                              const payerNote = ` - دفع بواسطة: ${payer}`;
                              newWalletTransactions.push({
                                  id: `${baseId}_split${idx}`,
                                  type: 'سحب',
                                  amount: splitAmount,"""

content = content.replace(target, insertion)

target2 = """                      } else {
                          const payerNote = expensePaidBy ? ` - دفع بواسطة: ${expensePaidBy}` : '';
                          newWalletTransactions.push({
                              id: baseId,
                              type: 'سحب',
                              amount: amount,"""

insertion2 = """                      } else {
                          if (expensePaidBy && expensePaidBy !== 'المحفظة العامة') {
                              newWalletTransactions.push({
                                  id: `${baseId}_fund`,
                                  type: 'إيداع',
                                  amount: amount,
                                  date: new Date(date.getTime() + msOffset - 1).toISOString(),
                                  note: `تمويل مصروف من الشريك: ${expensePaidBy}`,
                                  category: 'supply_deposit',
                                  status: 'completed',
                                  details: { partnerName: expensePaidBy }
                              } as Transaction);
                          }
                          const payerNote = expensePaidBy ? ` - دفع بواسطة: ${expensePaidBy}` : '';
                          newWalletTransactions.push({
                              id: baseId,
                              type: 'سحب',
                              amount: amount,"""

content = content.replace(target2, insertion2)

with open("components/SuppliersPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed wallet expense deposits")
