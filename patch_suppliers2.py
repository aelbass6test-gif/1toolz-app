import re

with open('components/SuppliersPage.tsx', 'r') as f:
    content = f.read()

# Add updatedCashHolders to setSettings block in handleSaveOrder
old_set_settings_start = """          let updatedSuppliers = [...(prev.suppliers || [])];
          let updatedPartners = [...(prev.partners || [])];
          let updatedPartnerTransactions = [...(prev.partnerTransactions || [])];"""
new_set_settings_start = """          let updatedSuppliers = [...(prev.suppliers || [])];
          let updatedPartners = [...(prev.partners || [])];
          let updatedPartnerTransactions = [...(prev.partnerTransactions || [])];
          let updatedCashHolders = [...(prev.cashHolders || [])];"""
content = content.replace(old_set_settings_start, new_set_settings_start)

# Add revert logic for custody
old_revert_partner = """              // Revert Partner Balance if was partner funded
              if (currentOldOrder.paymentMethod === 'partner') {"""
new_revert_custody = """              // Revert Custody if was custody funded
              if (currentOldOrder.paymentMethod === 'custody') {
                  const oldCustodyPayments = currentOldOrder.custodyPayments || [];
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

              // Revert Partner Balance if was partner funded
              if (currentOldOrder.paymentMethod === 'partner') {"""
content = content.replace(old_revert_partner, new_revert_custody)

# Process new custody logic
old_new_partner = """              // 4. Update Partner Balance if partner funded
              if (paymentMethod === 'partner') {"""
new_new_custody = """              // Update Cash Holders if custody funded
              if (paymentMethod === 'custody') {
                  custodyPayments.forEach(cp => {
                      const cIdx = updatedCashHolders.findIndex(h => h.userId === cp.cashHolderId);
                      if (cIdx > -1) {
                          updatedCashHolders[cIdx] = {
                              ...updatedCashHolders[cIdx],
                              currentBalance: (updatedCashHolders[cIdx].currentBalance || 0) - cp.amount,
                              lastUpdated: now.toISOString()
                          };
                      }
                  });
              }

              // 4. Update Partner Balance if partner funded
              if (paymentMethod === 'partner') {"""
content = content.replace(old_new_partner, new_new_custody)

# Add to newOrder
old_new_order = """                  treasuryAccountId: paymentMethod === 'treasury' ? selectedTreasuryAccountId : undefined,
                  treasuryPayments: paymentMethod === 'treasury' && isSplitTreasury ? treasuryPayments : undefined,
                  warehouseId: selectedWarehouseId,"""
new_new_order = """                  treasuryAccountId: paymentMethod === 'treasury' ? selectedTreasuryAccountId : undefined,
                  treasuryPayments: paymentMethod === 'treasury' && isSplitTreasury ? treasuryPayments : undefined,
                  custodyPayments: paymentMethod === 'custody' ? custodyPayments : undefined,
                  warehouseId: selectedWarehouseId,"""
content = content.replace(old_new_order, new_new_order)
content = content.replace(old_new_order, new_new_order) # Replace in both if (editingOrder) and else blocks

# Also in return of setSettings:
old_return_settings = """              partners: updatedPartners,
              partnerTransactions: updatedPartnerTransactions
          };"""
new_return_settings = """              partners: updatedPartners,
              partnerTransactions: updatedPartnerTransactions,
              cashHolders: updatedCashHolders
          };"""
content = content.replace(old_return_settings, new_return_settings)


with open('components/SuppliersPage.tsx', 'w') as f:
    f.write(content)
