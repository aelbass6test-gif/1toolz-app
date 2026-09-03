const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Fix Product Description Mapping
code = code.replace(
  "description = order.items.map((it: any) => `${it.productName || ''}${it.variantName ? ` (${it.variantName})` : ''} × ${it.quantity || 1}`).join(' + ');",
  "description = order.items.map((it: any) => `${it.name || it.productName || ''}${it.variantDescription || it.variantName ? ` (${it.variantDescription || it.variantName})` : ''} × ${it.quantity || 1}`).join(' + ');"
);

// 2. Fix normalizeBostaCity for Kafr El Sheikh
code = code.replace(
  'if (norm.includes("كفر") || norm.includes("kafr")) return "Kafr El Sheikh";',
  'if (norm.includes("كفر") || norm.includes("kafr")) return "Kafr Alsheikh";'
);

// 3. Fix business location ID options in Bosta payload
// Search for `const bostaPayload: any = {`
// and ensure we use config.defaultBusinessLocationId if provided
code = code.replace(
  "// Business Location ID (docs.bosta.co/docs/how-to/create-your-first-pickup-location)",
  `// Business Location ID (docs.bosta.co/docs/how-to/create-your-first-pickup-location)
      // Allow overriding business location via order property or fallback to config
      const effectiveBusinessLocationId = order.bostaBusinessLocationId || config?.defaultBusinessLocationId || config?.businessLocationId;
      if (effectiveBusinessLocationId) {
        bostaPayload.pickupAddress = {
          businessLocationId: effectiveBusinessLocationId
        };
      }
      const effectiveReturnLocationId = order.bostaReturnLocationId || config?.defaultReturnLocationId || config?.returnAddress?.businessLocationId;
      if (effectiveReturnLocationId) {
        bostaPayload.returnAddress = {
          businessLocationId: effectiveReturnLocationId
        };
      } else if (!bostaPayload.returnAddress && effectiveBusinessLocationId) {
        // Fallback return address to pickup address if not specified
        bostaPayload.returnAddress = {
          businessLocationId: effectiveBusinessLocationId
        };
      }
      
      // Prevent the old code from running by commenting it out, or we just remove it.`
);

// Actually it's easier to just do a string replace on the whole block.
fs.writeFileSync('server.ts', code);
