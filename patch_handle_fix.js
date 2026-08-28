import fs from 'fs';
let content = fs.readFileSync('components/DeveloperSettingsPage.tsx', 'utf8');

const ALTER_SUPPLY_ORDERS = `
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "partnerPayments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "treasuryPayments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "custodyPayments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "shippingFees" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "otherFees" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "discount" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "taxRate" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "taxAmount" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "grandTotal" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
`;

if (!content.includes('ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "treasuryPayments" JSONB')) {
    content = content.replace(
        'ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "balance" NUMERIC DEFAULT 0;',
        'ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "balance" NUMERIC DEFAULT 0;\n' + ALTER_SUPPLY_ORDERS
    );
    fs.writeFileSync('components/DeveloperSettingsPage.tsx', content, 'utf8');
    console.log("Patched DeveloperSettingsPage.tsx handleFixDBSchema!");
}
