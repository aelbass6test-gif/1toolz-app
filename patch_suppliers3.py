import re

with open('components/SuppliersPage.tsx', 'r') as f:
    content = f.read()

# Add cashHolders pass to SupplyOrderModal
old_modal_props = """        partnerPayments={partnerPayments}
        setPartnerPayments={setPartnerPayments}
        custodyPayments={custodyPayments}
        setCustodyPayments={setCustodyPayments}"""
new_modal_props = """        partnerPayments={partnerPayments}
        setPartnerPayments={setPartnerPayments}
        custodyPayments={custodyPayments}
        setCustodyPayments={setCustodyPayments}
        cashHolders={settings.cashHolders || []}"""
content = content.replace(old_modal_props, new_modal_props)

with open('components/SuppliersPage.tsx', 'w') as f:
    f.write(content)
