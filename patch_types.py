import re

with open('types.ts', 'r') as f:
    content = f.read()

# Update paymentMethod
old_payment = "paymentMethod?: 'cash' | 'credit' | 'partner' | 'supply_wallet' | 'treasury';"
new_payment = "paymentMethod?: 'cash' | 'credit' | 'partner' | 'supply_wallet' | 'treasury' | 'custody';"
content = content.replace(old_payment, new_payment)

# Add custodyPayments
old_treasury_payments = "treasuryPayments?: TreasuryPayment[]; // New field for multiple treasury/custody accounts"
new_treasury_payments = "treasuryPayments?: TreasuryPayment[]; // New field for multiple treasury/custody accounts\n  custodyPayments?: { cashHolderId: string, amount: number }[]; // New field for custody payments"
content = content.replace(old_treasury_payments, new_treasury_payments)

with open('types.ts', 'w') as f:
    f.write(content)
