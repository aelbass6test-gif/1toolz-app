import re

with open('components/SuppliersPage.tsx', 'r') as f:
    content = f.read()

# Add state
state_pattern = "const \[partnerPayments, setPartnerPayments\] = useState<{ partnerId: string, amount: number }>\[\]\(\[\]\);"
new_state = "const [partnerPayments, setPartnerPayments] = useState<{ partnerId: string, amount: number }[]>([]);\n  const [custodyPayments, setCustodyPayments] = useState<{ cashHolderId: string, amount: number }[]>([]);"
content = content.replace("  const [partnerPayments, setPartnerPayments] = useState<{ partnerId: string, amount: number }[]>([]);", new_state)

# Pass to SupplyOrderModal
modal_props = "partnerPayments={partnerPayments}\n        setPartnerPayments={setPartnerPayments}"
new_modal_props = "partnerPayments={partnerPayments}\n        setPartnerPayments={setPartnerPayments}\n        custodyPayments={custodyPayments}\n        setCustodyPayments={setCustodyPayments}"
content = content.replace(modal_props, new_modal_props)

with open('components/SuppliersPage.tsx', 'w') as f:
    f.write(content)
