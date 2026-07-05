import re

with open('components/SuppliersPage.tsx', 'r') as f:
    content = f.read()

# Fix order history rendering
old_history = """order.paymentMethod === 'credit' ? 'bg-rose-500' : order.paymentMethod === 'partner' ? 'bg-amber-500' : 'bg-emerald-500'"""
new_history = """order.paymentMethod === 'credit' ? 'bg-rose-500' : order.paymentMethod === 'partner' ? 'bg-amber-500' : order.paymentMethod === 'custody' ? 'bg-teal-500' : 'bg-emerald-500'"""
content = content.replace(old_history, new_history)

old_history_text = """{order.paymentMethod === 'credit' ? 'آجل مديونية' : order.paymentMethod === 'partner' ? 'تمويل شركاء' : 'مدفوعة كاش'}"""
new_history_text = """{order.paymentMethod === 'credit' ? 'آجل مديونية' : order.paymentMethod === 'partner' ? 'تمويل شركاء' : order.paymentMethod === 'custody' ? 'عهدة شخصية' : 'مدفوعة كاش'}"""
content = content.replace(old_history_text, new_history_text)

# Print invoice
old_print = """${order.paymentMethod === 'credit' ? 'آجل مديونية معلقة' : order.paymentMethod === 'partner' ? 'تمويل شركاء' : order.paymentMethod === 'supply_wallet' ? 'تمويل محفظة التوريد' : order.paymentMethod === 'treasury' ? 'تمويل من الخزينة' : 'نقدي (كاش)'}"""
new_print = """${order.paymentMethod === 'credit' ? 'آجل مديونية معلقة' : order.paymentMethod === 'partner' ? 'تمويل شركاء' : order.paymentMethod === 'custody' ? 'سداد عهدة شخصية' : order.paymentMethod === 'supply_wallet' ? 'تمويل محفظة التوريد' : order.paymentMethod === 'treasury' ? 'تمويل من الخزينة' : 'نقدي (كاش)'}"""
content = content.replace(old_print, new_print)

old_paymethod_text = """const payMethodText = order.paymentMethod === 'credit' ? 'آجل مديونية' : order.paymentMethod === 'partner' ? 'تمويل شركاء' : order.paymentMethod === 'supply_wallet' ? 'محفظة توريد كاش' : 'نقدي (كاش)';"""
new_paymethod_text = """const payMethodText = order.paymentMethod === 'credit' ? 'آجل مديونية' : order.paymentMethod === 'partner' ? 'تمويل شركاء' : order.paymentMethod === 'custody' ? 'عهدة شخصية' : order.paymentMethod === 'supply_wallet' ? 'محفظة توريد كاش' : 'نقدي (كاش)';"""
content = content.replace(old_paymethod_text, new_paymethod_text)


with open('components/SuppliersPage.tsx', 'w') as f:
    f.write(content)
