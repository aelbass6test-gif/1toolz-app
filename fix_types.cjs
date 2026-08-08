const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf8');
code = code.replace(/declare global \{\n  const google: \{\n    script: \{\n      run: \{\n        withSuccessHandler\(handler: \(response: any\) => void\): any;\n        withFailureHandler\(handler: \(error: Error\) => void\): any;\n        serverApiCall\(storeId: string, action: string, payload: any \| null\): void;\n      \};\n    \};\n  \};\n\}/g, '');
fs.writeFileSync('types.ts', code);
