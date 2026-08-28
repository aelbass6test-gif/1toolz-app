import fs from 'fs';
let content = fs.readFileSync('services/databaseService.ts', 'utf8');

if (content.includes("if (table === 'cash_holders')")) {
    const replacement = `if (table === 'supply_orders') {
                        mappedItem = {
                            ...mappedItem,
                            supplier_id: cleanItem.supplierId || cleanItem.supplier_id || '',
                            total_cost: Number(cleanItem.totalCost ?? cleanItem.total_cost ?? 0)
                        };
                    } else if (table === 'cash_holders')`;
    
    content = content.replace("if (table === 'cash_holders')", replacement);
    fs.writeFileSync('services/databaseService.ts', content, 'utf8');
    console.log("Fixed databaseService.ts supply_orders mapping!");
} else {
    console.log("Could not find cash_holders block.");
}
