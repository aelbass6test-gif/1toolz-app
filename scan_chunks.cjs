const fs = require('fs');
const https = require('https');

https.get('https://manus.im/share/file/a712baa5-d8d3-442e-bb8a-3801d22f01ac', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Find all chunks in the page
    const chunks = [...new Set(d.match(/https:\/\/files\.manuscdn\.com\/webapp\/_next\/static\/chunks\/[a-zA-Z0-9_\-\.]+\.js/g) || [])];
    console.log('Total chunks:', chunks.length);
    let found = false;

    async function scan() {
      for (const url of chunks) {
        await new Promise(resChunk => {
          https.get(url, res => {
            let chunkData = '';
            res.on('data', c => chunkData += c);
            res.on('end', () => {
              if (chunkData.includes('share/file') || chunkData.includes('fileShare') || chunkData.includes('file_share')) {
                console.log('\nFound in chunk:', url);
                // Look around fileShare
                let pos = 0;
                while ((pos = chunkData.indexOf('fileShare', pos)) !== -1) {
                  console.log(chunkData.slice(Math.max(0, pos - 100), Math.min(chunkData.length, pos + 200)));
                  pos += 10;
                  if (pos > 500000) break;
                }
              }
              resChunk();
            });
          }).on('error', () => resChunk());
        });
      }
    }
    scan();
  });
});
