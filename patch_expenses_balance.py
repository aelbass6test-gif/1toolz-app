import re

with open("components/SuppliersPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

pattern = r"if\s*\(isShipping\s*&&\s*shippingFeesPaymentMethod\s*===\s*'wallet'\)\s*\{\s*newBalance\s*-=\s*amount;\s*\}"

new_logic = """if (isShipping && shippingFeesPaymentMethod === 'wallet') {
                          newBalance -= amount;
                      } else if (!isShipping && expensePaidBy === 'المحفظة العامة') {
                          newBalance -= amount;
                      } else if (!isShipping && expensePaidBy && expensePaidBy !== 'المحفظة العامة') {
                          const payersList = expensePaidBy.split(' و ').map(s => s.trim()).filter(Boolean);
                          const splitAmount = amount / payersList.length;
                          payersList.forEach((payer, idx) => {
                              const partnerIdx = updatedPartners.findIndex(p => p.name === payer);
                              if (partnerIdx > -1) {
                                  updatedPartners[partnerIdx] = {
                                      ...updatedPartners[partnerIdx],
                                      balance: (updatedPartners[partnerIdx].balance || 0) + splitAmount
                                  };
                                  updatedPartnerTransactions.push({
                                      id: `${baseId}_pt_${idx}`,
                                      partnerId: updatedPartners[partnerIdx].id,
                                      type: 'supply_funding',
                                      amount: splitAmount,
                                      date: new Date(date.getTime() + msOffset + idx).toISOString(),
                                      treasuryAccountId: undefined,
                                      reference: baseId,
                                      note: baseNote
                                  } as any);
                              }
                          });
                      }"""

if re.search(pattern, content):
    content = re.sub(pattern, new_logic, content)
    with open("components/SuppliersPage.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Could not find pattern")
