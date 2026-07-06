import re

with open("components/SuppliersPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove the broken part from setWallet
broken_logic = """} else if (!isShipping && expensePaidBy && expensePaidBy !== 'المحفظة العامة') {
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

if broken_logic in content:
    content = content.replace(broken_logic, "")
else:
    print("Could not find broken_logic in setWallet!")

# Let's insert the updatedPartners logic into updateSettings.
# Around line 815, before // 6. Update Treasury Balance

insertion = """
          // Handle expensePaidBy splitting for Partners
          const handlePartnerExpense = (amountStr: number, baseNote: string, baseId: string) => {
              if (amountStr <= 0 || !expensePaidBy || expensePaidBy === 'المحفظة العامة') return;
              
              const payersList = expensePaidBy.split(' و ').map(s => s.trim()).filter(Boolean);
              if (payersList.length === 0) return;
              
              const splitAmount = amountStr / payersList.length;
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
                          date: new Date().toISOString(),
                          note: `${baseNote} - دفع بواسطة: ${payer}`,
                          reference: baseId
                      } as any);
                  }
              });
          };

          if (recordExpensesFormally || shippingFeesPaymentMethod === 'with_order') {
              if (shippingFees > 0 && shippingFeesPaymentMethod === 'with_order' && paymentMethod !== 'partner') {
                   // if paymentMethod is partner, it's already included in total funding. If not, maybe paid by someone else?
                   // Wait, if it's with_order, it's included in totalCost. So the expensePaidBy is only for separate expenses?
                   // Usually expensePaidBy is applied to the separate expenses.
              }
          }
          
          if (shippingFees > 0 && shippingFeesPaymentMethod !== 'with_order') {
               handlePartnerExpense(shippingFees, `مصاريف شحن (فاتورة مورد: ${supplier?.name})`, `supply_expense_shipping_${currentOrderId}`);
          }
          if (otherFees > 0 && recordExpensesFormally) {
               handlePartnerExpense(otherFees, `مصاريف إضافية (فاتورة مورد: ${supplier?.name})`, `supply_expense_other_${currentOrderId}`);
          }
"""

if "// 6. Update Treasury Balance" in content:
    content = content.replace("// 6. Update Treasury Balance", insertion + "\n          // 6. Update Treasury Balance")
else:
    print("Could not find // 6. Update Treasury Balance")

with open("components/SuppliersPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied fix_suppliers_expenses.py")
