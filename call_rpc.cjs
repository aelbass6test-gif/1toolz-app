const https = require('https');

const postData = JSON.stringify({
  shareId: "a712baa5-d8d3-442e-bb8a-3801d22f01ac",
  displayParams: {}
});

const req = https.request({
  hostname: 'api.manus.im',
  path: '/addon.v1.AddonShareService/OpenSharedResource',
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
    console.log('Response:', d);
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(d);
        console.log('Parsed JSON:', JSON.stringify(json, null, 2));
      } catch (e) {
        console.log('Not json:', e.message);
      }
    }
  });
});

req.on('error', e => console.error(e));
req.write(postData);
req.end();
