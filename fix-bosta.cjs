const fs = require('fs');
let content = fs.readFileSync('utils/bostaService.ts', 'utf-8');

// The issue is in verifyConnection:
// if (res && typeof res === 'object' && res.success !== undefined && !res.isHtmlResponse) {
//   return res;
// }
// If the worker returns { success: false, error: "Worker interception...", isHtmlResponse: false }
// Then res.success is false, and it returns it IMMEDIATELY instead of falling back to direct bosta check.
// We need to change the condition so it falls back if success is false AND error includes "Worker interception"

content = content.replace(
  /if \(res && typeof res === 'object' && res\.success !== undefined && !res\.isHtmlResponse\) \{\n      return res;\n    \}/,
  `if (res && typeof res === 'object' && res.success !== undefined && !res.isHtmlResponse) {
      // If Cloudflare Worker intercepted it, force the fallback
      if (res.error && String(res.error).includes('Worker interception')) {
        console.warn('[BOSTA-SERVICE] Cloudflare Worker intercepted the request. Forcing direct fallback.');
      } else {
        return res;
      }
    }`
);

fs.writeFileSync('utils/bostaService.ts', content);
console.log('Fixed verifyConnection');
