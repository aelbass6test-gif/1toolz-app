import re

with open("components/PartnersPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

target = "category: isWithdrawal ? 'partner_withdrawal' : 'partner_deposit',"
replacement = "category: isWithdrawal ? 'profit_withdrawal' : 'capital_addition',"

if target in content:
    content = content.replace(target, replacement)
    with open("components/PartnersPage.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed category mismatch in PartnersPage")
else:
    print("Could not find target")
