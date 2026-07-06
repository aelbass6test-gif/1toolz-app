import re

with open("components/SuppliersPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

target = """              // Revert Partner Balance if was partner funded
              if (currentOldOrder.paymentMethod === 'partner') {"""

insertion = """              // Revert Partner Expenses if any
              const partnerExpenseTxs = updatedPartnerTransactions.filter(pt => 
                  pt.id.startsWith(`supply_expense_shipping_${currentOldOrder.id}_pt_`) ||
                  pt.id.startsWith(`supply_expense_other_${currentOldOrder.id}_pt_`)
              );
              partnerExpenseTxs.forEach(pt => {
                  const pIdx = updatedPartners.findIndex(p => p.id === pt.partnerId);
                  if (pIdx > -1) {
                      updatedPartners[pIdx] = {
                          ...updatedPartners[pIdx],
                          balance: (updatedPartners[pIdx].balance || 0) - pt.amount
                      };
                  }
              });
              updatedPartnerTransactions = updatedPartnerTransactions.filter(pt => 
                  !pt.id.startsWith(`supply_expense_shipping_${currentOldOrder.id}_pt_`) &&
                  !pt.id.startsWith(`supply_expense_other_${currentOldOrder.id}_pt_`)
              );
              
              // Revert Partner Balance if was partner funded
              if (currentOldOrder.paymentMethod === 'partner') {"""

if target in content:
    content = content.replace(target, insertion)
    with open("components/SuppliersPage.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed partner expenses reversion")
else:
    print("Target not found")
