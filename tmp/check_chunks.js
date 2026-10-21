const fs = require('fs');
const https = require('https');

const html = fs.readFileSync('/tmp/manus.html', 'utf8');
const chunks = [...new Set(html.match(/https:\/\/files\.manuscdn\.com\/webapp\/_next\/static\/chunks\/[a-zA-Z0-9_\-\.]+\.js/g) || [])];

console.log('Found unique chunks:', chunks.length);

async function run() {
  for (const chunk of chunks) {
    await new Promise(resolve => {
      https.get(chunk, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          if (d.includes('fileShareId') || d.includes('/share/file/')) {
            console.log('Hit in chunk:', chunk);
            // Search for http requests or endpoints in this chunk
            const matches = d.match(/["'`](https?:\/\/[^"'`]+|\/api\/[^"'`]+|\/[a-zA-Z0-9_\-]+\/fileShare[^"'`]*)["'`]/g) || [];
            console.log('Matches:', matches.slice(0, 15));
            // Let's also check for method names or RPC
            const rpc = d.match(/[a-zA-Z0-9_]+Rpc|[a-zA-Z0-9_]+Query|[a-zA-Z0-9_]+Mutation/g) || [];
            console.log('RPC:', [...new Set(rpc)].slice(0, 10));
          }
          resolve();
        });
      }).on('error', () => resolve());
    });
  }
}
run();
