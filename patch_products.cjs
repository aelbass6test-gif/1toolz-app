const fs = require('fs');
const content = fs.readFileSync('components/ProductsPage.tsx', 'utf8');

const targetContent = `
  const invoicesStockMap = useMemo(() => {
    // Basic maps to hold standard calculations
    const rawPMap: Record<string, number> = {};
    const rawVMap: Record<string, number> = {};
    
    // Track supply order returns
    const soReturnedPMap: Record<string, number> = {};
    const soReturnedVMap: Record<string, number> = {};

    // Helper maps to resolve variant IDs to product IDs and check existence
    const variantToProductMap: Record<string, string> = {};
    const productHasVariantsMap: Record<string, boolean> = {};
    const productVariantsListMap: Record<string, string[]> = {};

    (settings.products || []).forEach(p => {
        const pId = String(p.id).trim();
        productHasVariantsMap[pId] = !!p.hasVariants;
        if (p.hasVariants && p.variants) {
            productVariantsListMap[pId] = p.variants.map(v => {
                const vId = String(v.id).trim();
                variantToProductMap[vId] = pId;
                return vId;
            });
        }
    });

    // Normalize IDs to handle any spacing, string null/undefined issues
    const normalizeId = (id: any): string | null => {
        if (id === undefined || id === null) return null;
        const s = String(id).trim();
        if (s === '' || s === 'null' || s === 'undefined') return null;
        return s;
    };
`;

const newContentStr = `
  const invoicesStockMap = useMemo(() => {
    // Basic maps to hold standard calculations
    const rawPMap: Record<string, number> = {};
    const rawVMap: Record<string, number> = {};
    
    // Track supply order returns
    const soReturnedPMap: Record<string, number> = {};
    const soReturnedVMap: Record<string, number> = {};

    // Base maps from latest audits
    const auditTimePMap: Record<string, number> = {};
    const auditTimeVMap: Record<string, number> = {};

    // Helper maps to resolve variant IDs to product IDs and check existence
    const variantToProductMap: Record<string, string> = {};
    const productHasVariantsMap: Record<string, boolean> = {};
    const productVariantsListMap: Record<string, string[]> = {};

    (settings.products || []).forEach(p => {
        const pId = String(p.id).trim();
        productHasVariantsMap[pId] = !!p.hasVariants;
        if (p.hasVariants && p.variants) {
            productVariantsListMap[pId] = p.variants.map(v => {
                const vId = String(v.id).trim();
                variantToProductMap[vId] = pId;
                return vId;
            });
        }
    });

    // Normalize IDs to handle any spacing, string null/undefined issues
    const normalizeId = (id: any): string | null => {
        if (id === undefined || id === null) return null;
        const s = String(id).trim();
        if (s === '' || s === 'null' || s === 'undefined') return null;
        return s;
    };

    if (settings.inventoryAudits) {
        // Sort ascending by time so latest audit overwrites earlier ones
        const sortedAudits = [...settings.inventoryAudits].sort((a, b) => {
            const timeA = a.timestamp || new Date(a.date).getTime();
            const timeB = b.timestamp || new Date(b.date).getTime();
            return timeA - timeB;
        });

        sortedAudits.forEach(audit => {
            const auditTime = audit.timestamp || new Date(audit.date).getTime();
            audit.discrepancies?.forEach(d => {
                const pId = normalizeId(d.productId);
                const vId = normalizeId(d.variantId);
                
                if (pId) {
                    if (vId) {
                        rawVMap[vId] = d.actualQty;
                        auditTimeVMap[vId] = auditTime;
                    } else {
                        rawPMap[pId] = d.actualQty;
                        auditTimePMap[pId] = auditTime;
                    }
                }
            });
        });
    }

    const isAfterAudit = (pId: string | null, vId: string | null, txDate: string) => {
        const txTime = new Date(txDate).getTime();
        if (vId && auditTimeVMap[vId] !== undefined) {
            return txTime > auditTimeVMap[vId];
        }
        if (pId && auditTimePMap[pId] !== undefined) {
            return txTime > auditTimePMap[pId];
        }
        return true;
    };
`;

let newFileContent = content.replace(targetContent, newContentStr);
fs.writeFileSync('components/ProductsPage.tsx', newFileContent);
