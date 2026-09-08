const fs = require('fs');
let content = fs.readFileSync('src/cloudflare-app.ts', 'utf-8');

// The previous regex missed the custom vite integration block. Let's do a more robust cleanup.

// 1. Find the last "app.post("/api/webhooks/turbo" ...)" block and truncate everything after it.
const truncateMarker = '  app.post("/api/webhook/turbo", handleTurboWebhook);';
const truncateIndex = content.lastIndexOf(truncateMarker);

if (truncateIndex !== -1) {
    content = content.substring(0, truncateIndex + truncateMarker.length) + '\n\nexport default app;\n';
}

fs.writeFileSync('src/cloudflare-app.ts', content);
console.log('Fixed src/cloudflare-app.ts');
