import re

with open('components/POSPage.tsx', 'r') as f:
    content = f.read()

old_code = """      if (!isCredit && !settings.disableCustodySelling) {
        const hIdx = updatedHolders.findIndex(h => String(h.userId) === String(finalCashHolder));
        const receiverName = normalizeName(receiver?.name || 'مستلم');
        
        if (hIdx > -1) {
          updatedHolders[hIdx].currentBalance += totalAmount;
          updatedHolders[hIdx].lastUpdated = new Date().toISOString();
        } else {
          updatedHolders.push({
            userId: finalCashHolder,
            userName: receiverName,
            currentBalance: totalAmount,
            lastUpdated: new Date().toISOString()
          });
        }

        // Add to Cash Handovers log (سجل العهد)
        updatedHandovers.unshift({
          id: `pos-handover-${Date.now()}`,
          fromUserId: 'system',
          fromUserName: 'النظام',
          toUserId: finalCashHolder,
          toUserName: receiverName,
          amount: totalAmount,
          date: new Date().toISOString(),
          notes: `مبيعات كاشير - طلب #${saleNumber}`,
          type: 'handover',
          status: 'completed',
          orderId: saleId // Explicitly link handover to this sale order
        });
      }"""

new_code = """      let updatedTreasury = null;
      if (treasury) {
         if (Array.isArray(treasury)) {
             updatedTreasury = { accounts: [...treasury], transactions: [] };
         } else if (Array.isArray(treasury.accounts)) {
             updatedTreasury = { accounts: [...treasury.accounts], transactions: [...(treasury.transactions || [])] };
         } else {
             updatedTreasury = { accounts: Object.values(treasury || {}), transactions: [] };
         }
      }

      if (!isCredit && !settings.disableCustodySelling) {
        const receiverName = normalizeName(receiver?.name || 'مستلم');

        if (finalCashHolder.startsWith('treas_') && updatedTreasury) {
          const treasuryAccountId = finalCashHolder.substring(6);
          const tAccIdx = updatedTreasury.accounts.findIndex((a: any) => a.id === treasuryAccountId);
          if (tAccIdx > -1) {
             updatedTreasury.accounts[tAccIdx] = {
                 ...updatedTreasury.accounts[tAccIdx],
                 balance: (updatedTreasury.accounts[tAccIdx].balance || 0) + totalAmount
             };
             updatedTreasury.transactions.unshift({
                 id: `pos-treas-${Date.now()}`,
                 date: new Date().toISOString(),
                 toAccountId: treasuryAccountId,
                 amount: totalAmount,
                 type: 'deposit',
                 description: `مبيعات كاشير - طلب #${saleNumber}`,
                 reference: saleId
             });
          }
        } else {
          const hIdx = updatedHolders.findIndex(h => String(h.userId) === String(finalCashHolder));
          if (hIdx > -1) {
            updatedHolders[hIdx].currentBalance += totalAmount;
            updatedHolders[hIdx].lastUpdated = new Date().toISOString();
          } else {
            updatedHolders.push({
              userId: finalCashHolder,
              userName: receiverName,
              currentBalance: totalAmount,
              lastUpdated: new Date().toISOString()
            });
          }

          // Add to Cash Handovers log (سجل العهد)
          updatedHandovers.unshift({
            id: `pos-handover-${Date.now()}`,
            fromUserId: 'system',
            fromUserName: 'النظام',
            toUserId: finalCashHolder,
            toUserName: receiverName,
            amount: totalAmount,
            date: new Date().toISOString(),
            notes: `مبيعات كاشير - طلب #${saleNumber}`,
            type: 'handover',
            status: 'completed',
            orderId: saleId // Explicitly link handover to this sale order
          });
        }
      }"""

content = content.replace(old_code, new_code)

old_update_store = """      // Perform a single atomic update to the store data
      updateStoreData({ 
        settings: newSettings, 
        orders: [newOrder, ...orders],
        wallet: updatedWallet
      });"""

new_update_store = """      // Perform a single atomic update to the store data
      const dataToUpdate: any = { 
        settings: newSettings, 
        orders: [newOrder, ...orders],
        wallet: updatedWallet
      };
      if (updatedTreasury) {
        dataToUpdate.treasury = updatedTreasury;
      }
      updateStoreData(dataToUpdate);"""

content = content.replace(old_update_store, new_update_store)

with open('components/POSPage.tsx', 'w') as f:
    f.write(content)

