import re

with open('components/SuppliersPage.tsx', 'r') as f:
    content = f.read()

# Add updatedCashHolders in delete block
old_delete_start = """          let updatedSuppliers = [...prev.suppliers];
          let updatedPartners = [...(prev.partners || [])];
          let updatedPartnerTransactions = [...(prev.partnerTransactions || [])];"""
new_delete_start = """          let updatedSuppliers = [...prev.suppliers];
          let updatedPartners = [...(prev.partners || [])];
          let updatedPartnerTransactions = [...(prev.partnerTransactions || [])];
          let updatedCashHolders = [...(prev.cashHolders || [])];"""
content = content.replace(old_delete_start, new_delete_start)

# Add revert logic for custody
old_delete_partner = """          if (order.paymentMethod === 'partner') {"""
new_delete_custody = """          if (order.paymentMethod === 'custody') {
              const oldCustodyPayments = order.custodyPayments || [];
              oldCustodyPayments.forEach(cp => {
                  const cIdx = updatedCashHolders.findIndex(h => h.userId === cp.cashHolderId);
                  if (cIdx > -1) {
                      updatedCashHolders[cIdx] = {
                          ...updatedCashHolders[cIdx],
                          currentBalance: (updatedCashHolders[cIdx].currentBalance || 0) + cp.amount
                      };
                  }
              });
          }

          if (order.paymentMethod === 'partner') {"""
content = content.replace(old_delete_partner, new_delete_custody)

# Also in return of setSettings:
old_delete_return = """            suppliers: updatedSuppliers,
            partners: updatedPartners,
            partnerTransactions: updatedPartnerTransactions,
            products: prev.products.map(p => {"""
new_delete_return = """            suppliers: updatedSuppliers,
            partners: updatedPartners,
            partnerTransactions: updatedPartnerTransactions,
            cashHolders: updatedCashHolders,
            products: prev.products.map(p => {"""
content = content.replace(old_delete_return, new_delete_return)

with open('components/SuppliersPage.tsx', 'w') as f:
    f.write(content)
