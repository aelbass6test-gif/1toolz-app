import fs from 'fs';
let content = fs.readFileSync('components/DeveloperSettingsPage.tsx', 'utf8');

const MORE_COLS = `
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "treasuryPayments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "custodyPayments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "discount" NUMERIC DEFAULT 0;
`;

if (!content.includes('"treasuryPayments" JSONB')) {
    content = content.replace(
        'ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;',
        MORE_COLS + 'ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;'
    );
    fs.writeFileSync('components/DeveloperSettingsPage.tsx', content, 'utf8');
    console.log("Added more columns!");
}
