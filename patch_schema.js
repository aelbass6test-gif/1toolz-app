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
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "shippingFees" NUMERIC;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "otherFees" NUMERIC;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "discount" NUMERIC;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "cashHolderId" TEXT;
`;

if (!content.includes('"orderNumber" TEXT')) {
    content = content.replace(
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "debtHistory" JSONB DEFAULT \'[]\'::jsonb;',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "debtHistory" JSONB DEFAULT \'[]\'::jsonb;' + ALTER_SUPPLY_ORDERS
    );
    fs.writeFileSync('components/DeveloperSettingsPage.tsx', content, 'utf8');
    console.log("Patched DeveloperSettingsPage.tsx");
} else {
    console.log("Already patched.");
}
