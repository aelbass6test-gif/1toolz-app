const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function fixWallet() {
  const storesSnapshot = await db.collection('stores_data').get();
  for (const doc of storesSnapshot.docs) {
    const data = doc.data();
    let updated = false;
    
    let wallet = data.wallet || {};
    let treasury = data.settings?.treasury || {};
    let treasuryTxs = treasury.transactions || [];
    let walletTxs = wallet.transactions || [];
    
    let walletBalance = 0;
    
    walletTxs.forEach(wt => {
      if (wt.type === 'تحويل' && wt.category === 'treasury_sync') {
        const treasuryTxId = wt.id.replace('TR-', '');
        const tTx = treasuryTxs.find(t => t.id === treasuryTxId);
        if (tTx) {
          if (tTx.toAccountId === 'main_wallet' || tTx.toAccountId === 'supply_wallet') {
            wt.type = 'إيداع';
            console.log(`Fixed ${wt.id} to إيداع`);
            updated = true;
          } else if (tTx.fromAccountId === 'main_wallet' || tTx.fromAccountId === 'supply_wallet') {
            wt.type = 'سحب';
            console.log(`Fixed ${wt.id} to سحب`);
            updated = true;
          }
        } else {
           console.log(`Warning: TR Tx ${treasuryTxId} not found in treasury`);
           // Fallback: if user transferred 550, they said they transferred from bank to wallet. Let's make it deposit.
           if (wt.amount === 550 && wt.note?.includes('تحويل إنستاباي')) {
              wt.type = 'إيداع';
              updated = true;
           }
        }
      }
      
      // Also we need to recalculate balance if they want. 
      // But the UI already calculates it dynamically. 
      // Wait, let's fix the static balance in the wallet document as well.
      if (wt.type === 'إيداع' && wt.status === 'completed' && wt.category !== 'supply_purchase' && wt.category !== 'supply_deposit') {
         if (!wt.details?.paidByPartnerId && !wt.note?.includes('دفعهم')) {
             walletBalance += Number(wt.amount);
         }
      } else if (wt.type === 'سحب' && wt.status !== 'cancelled' && wt.category !== 'supply_purchase' && wt.category !== 'supply_deposit') {
         if (!wt.details?.paidByPartnerId && !wt.note?.includes('دفعهم')) {
             walletBalance -= Number(wt.amount);
         }
      }
    });
    
    if (updated) {
      await doc.ref.update({
        'wallet.transactions': walletTxs,
        'wallet.balance': walletBalance // fix static balance just in case
      });
      console.log(`Updated store ${doc.id}`);
    }
  }
}
fixWallet().then(() => console.log('Done')).catch(console.error);
