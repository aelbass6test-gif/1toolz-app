
import sys

file_path = 'components/OrdersList.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """  const computedTotal = Math.max(
    0,
    Math.round(
      safeProductPrice +
        safeShippingFee +
        safeTax +
        inspectionFee -
        safeDiscount -
        safeAdvance -
        safeCredit -
        safeReturnCash,
    ),
  );"""

replacement = """  const orderTotalValue = Math.max(0, Math.round(safeProductPrice + safeShippingFee + safeTax + inspectionFee - safeDiscount));
  const computedTotal = Math.max(
    0,
    Math.round(
      orderTotalValue -
        safeAdvance -
        safeCredit -
        safeReturnCash,
    ),
  );"""

# Replace all occurrences
new_content = content.replace(target, replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
