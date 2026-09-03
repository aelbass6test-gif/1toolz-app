const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf8');

if (!code.includes('defaultReturnLocationId')) {
  code = code.replace(
    '  defaultBusinessLocationId?: string;',
    '  defaultBusinessLocationId?: string;\n  defaultReturnLocationId?: string;'
  );
  fs.writeFileSync('types.ts', code);
}
