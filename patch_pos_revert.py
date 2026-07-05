import re

with open('components/POSPage.tsx', 'r') as f:
    content = f.read()

old_code = """    // Revert the cash holder balance if it's not credit and not wallet
    let updatedHolders = [...(settings.cashHolders || [])];
    if (sale.cashHolderId && sale.cashHolderId !== 'credit' && sale.cashHolderId !== 'wallet') {
      const cleanTargetId = String(sale.cashHolderId).replace(/^(emp_|part_|treas_)/, '');
      const hIdx = updatedHolders.findIndex(h => {
        const cleanHolderId = String(h.userId).replace(/^(emp_|part_|treas_)/, '');
        return String(h.userId) === String(sale.cashHolderId) || (cleanHolderId === cleanTargetId && cleanHolderId !== '');
      });
      if (hIdx > -1) {
        updatedHolders[hIdx] = {
          ...updatedHolders[hIdx],
          currentBalance: Math.max(0, (updatedHolders[hIdx].currentBalance || 0) - sale.totalAmount),
          lastUpdated: new Date().toISOString()
        };
      }
    }"""

new_code = """    let updatedTreasury = null;
    if (treasury) {
      if (Array.isArray(treasury)) {
         updatedTreasury = { accounts: [...treasury], transactions: [] };
      } else if (Array.isArray(treasury.accounts)) {
         updatedTreasury = { accounts: [...treasury.accounts], transactions: [...(treasury.transactions || [])] };
      } else {
         updatedTreasury = { accounts: Object.values(treasury || {}), transactions: [] };
      }
    }

    // Revert the cash holder balance if it's not credit and not wallet
    let updatedHolders = [...(settings.cashHolders || [])];
    if (sale.cashHolderId && sale.cashHolderId !== 'credit' && sale.cashHolderId !== 'wallet') {
      if (String(sale.cashHolderId).startsWith('treas_') && updatedTreasury) {
         const treasuryAccountId = String(sale.cashHolderId).substring(6);
         const tAccIdx = updatedTreasury.accounts.findIndex((a: any) => a.id === treasuryAccountId);
         if (tAccIdx > -1) {
             updatedTreasury.accounts[tAccIdx] = {
                 ...updatedTreasury.accounts[tAccIdx],
                 balance: Math.max(0, (updatedTreasury.accounts[tAccIdx].balance || 0) - sale.totalAmount)
             };
             updatedTreasury.transactions = updatedTreasury.transactions.filter((t: any) => t.reference !== sale.id);
         }
      } else {
        const cleanTargetId = String(sale.cashHolderId).replace(/^(emp_|part_|treas_)/, '');
        const hIdx = updatedHolders.findIndex(h => {
          const cleanHolderId = String(h.userId).replace(/^(emp_|part_|treas_)/, '');
          return String(h.userId) === String(sale.cashHolderId) || (cleanHolderId === cleanTargetId && cleanHolderId !== '');
        });
        if (hIdx > -1) {
          updatedHolders[hIdx] = {
            ...updatedHolders[hIdx],
            currentBalance: Math.max(0, (updatedHolders[hIdx].currentBalance || 0) - sale.totalAmount),
            lastUpdated: new Date().toISOString()
          };
        }
      }
    }"""

content = content.replace(old_code, new_code)

old_update = """    updateStoreData({
      orders: orders.filter(o => o.id !== sale.id),
      settings: newSettings,
      wallet: updatedWallet
    });"""

new_update = """    const dataToUpdate: any = {
      orders: orders.filter(o => o.id !== sale.id),
      settings: newSettings,
      wallet: updatedWallet
    };
    if (updatedTreasury) {
      dataToUpdate.treasury = updatedTreasury;
    }
    updateStoreData(dataToUpdate);"""

content = content.replace(old_update, new_update)

with open('components/POSPage.tsx', 'w') as f:
    f.write(content)

