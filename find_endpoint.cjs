const fs = require('fs');
const https = require('https');

const html = fs.readFileSync('/tmp/manus.html', 'utf8');
const chunks = [...new Set(html.match(/https:\/\/files\.manuscdn\.com\/webapp\/_next\/static\/chunks\/[a-zA-Z0-9_\-\.]+\.js/g) || [])];

async function findEndpoint() {
  for (const url of chunks) {
    await new Promise(resChunk => {
      https.get(url, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          if (d.includes('openSharedResource')) {
            console.log('openSharedResource in chunk:', url);
            let idx = d.indexOf('openSharedResource');
            console.log(d.slice(Math.max(0, idx - 100), Math.min(d.length, idx + 400)));
          }
          resChunk();
        });
      }).on('error', () => resChunk());
    });
  }
}
findEndpoint();
