import re

with open('components/SuppliersPage.tsx', 'r') as f:
    content = f.read()

# startEditOrder
old_start_edit = """      const initialPartnerPayments = order.partnerPayments || (order.partnerId ? [{ partnerId: order.partnerId, amount: order.totalCost || order.grandTotal || 0 }] : []);
      setPartnerPayments(initialPartnerPayments);"""
new_start_edit = """      const initialPartnerPayments = order.partnerPayments || (order.partnerId ? [{ partnerId: order.partnerId, amount: order.totalCost || order.grandTotal || 0 }] : []);
      setPartnerPayments(initialPartnerPayments);
      setCustodyPayments(order.custodyPayments || []);"""
content = content.replace(old_start_edit, new_start_edit)

# openNewOrderModal
old_open_new = """      setPartnerPayments([]);
      setSelectedPartnerId('');"""
new_open_new = """      setPartnerPayments([]);
      setCustodyPayments([]);
      setSelectedPartnerId('');"""
content = content.replace(old_open_new, new_open_new)

with open('components/SuppliersPage.tsx', 'w') as f:
    f.write(content)
