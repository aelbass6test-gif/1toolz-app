const https = require('https');

const postData = JSON.stringify({
  shareId: "a712baa5-d8d3-442e-bb8a-3801d22f01ac"
});

const req = https.request({
  hostname: 'api.manus.im',
  path: '/session.v1.SessionPublicService/GetSharedSessionFile',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'Mozilla/5.0'
  }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(d);
        console.log('Parsed:', JSON.stringify(json, null, 2));
        if (json.fileUrl) {
          console.log('\nFetching fileUrl:', json.fileUrl);
          const urlObj = new URL(json.fileUrl);
          const reqFile = (urlObj.protocol === 'https:' ? https : require('http')).get(json.fileUrl, r => {
            let fileData = '';
            r.on('data', chunk => fileData += chunk);
            r.on('end', () => {
              console.log('\n=== FILE CONTENT (First 3000 chars) ===');
              console.log(fileData.slice(0, 3000));
              require('fs').writeFileSync('/app/applet/shared_manus_file.md', fileData);
              console.log('\nFile saved to /app/applet/shared_manus_file.md (total bytes: ' + fileData.length + ')');
            });
          });
        }
      } catch (e) {
        console.log('JSON parse error:', e.message, d.slice(0, 500));
      }
    } else {
      console.log('Error response:', d);
    }
  });
});

req.on('error', e => console.error(e));
req.write(postData);
req.end();
