const https = require('https');

https.get('https://files.manuscdn.com/webapp/_next/static/chunks/2x8pix1ng4ex0.js', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    let idx = d.indexOf('AddonShareService=');
    console.log(d.slice(Math.max(0, idx - 100), Math.min(d.length, idx + 400)));
  });
});
