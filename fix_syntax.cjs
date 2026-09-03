const fs = require('fs');
let code = fs.readFileSync('components/BostaSystemPortal.tsx', 'utf8');

// There are places where we corrupted the object literal
// Let's replace the whole block carefully.
// I will just use regex to clean up the duplicate lines.
code = code.replace(/defaultPackageSize: apiSettings\.defaultPackageSize as any, defaultBusinessLocationId: apiSettings\.defaultBusinessLocationId, defaultReturnLocationId: apiSettings\.defaultReturnLocationId\n      defaultBusinessLocationId: apiSettings\.defaultBusinessLocationId,\n      defaultReturnLocationId: apiSettings\.defaultReturnLocationId,\n          defaultBusinessLocationId: apiSettings\.defaultBusinessLocationId,\n          defaultReturnLocationId: apiSettings\.defaultReturnLocationId,/g, 'defaultPackageSize: apiSettings.defaultPackageSize as any,\n          defaultBusinessLocationId: apiSettings.defaultBusinessLocationId,\n          defaultReturnLocationId: apiSettings.defaultReturnLocationId,');

fs.writeFileSync('components/BostaSystemPortal.tsx', code);
