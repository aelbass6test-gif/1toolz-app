const fs = require('fs');
let code = fs.readFileSync('components/BostaSystemPortal.tsx', 'utf8');

code = code.replace(/apiSettings\.apiKey/g, 'apiSettings.bostaApiKey');
code = code.replace(/defaultPackageSize: apiSettings\.defaultPackageSize as any,\n      defaultBusinessLocationId: apiSettings\.defaultBusinessLocationId,\n      defaultReturnLocationId: apiSettings\.defaultReturnLocationId,/g, 'defaultPackageSize: apiSettings.defaultPackageSize as any, defaultBusinessLocationId: apiSettings.defaultBusinessLocationId, defaultReturnLocationId: apiSettings.defaultReturnLocationId');
code = code.replace(/defaultPackageSize: apiSettings\.defaultPackageSize as any,\n          defaultBusinessLocationId: apiSettings\.defaultBusinessLocationId,\n          defaultReturnLocationId: apiSettings\.defaultReturnLocationId,/g, 'defaultPackageSize: apiSettings.defaultPackageSize as any, defaultBusinessLocationId: apiSettings.defaultBusinessLocationId, defaultReturnLocationId: apiSettings.defaultReturnLocationId');

code = code.replace(
  "      defaultPackageSize: 'SMALL',\n      defaultBusinessLocationId: '',\n      defaultReturnLocationId: ''\n    };",
  "      defaultPackageSize: 'SMALL',\n      defaultBusinessLocationId: '',\n      defaultReturnLocationId: '',\n      webhookUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/bosta` : '/api/webhooks/bosta'\n    };"
);

// We need to clean up the duplicated or syntax errors found in BostaSystemPortal.tsx
// Let's just fix it by replacing the whole thing.

fs.writeFileSync('components/BostaSystemPortal.tsx', code);
