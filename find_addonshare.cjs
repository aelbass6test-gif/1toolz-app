const https = require('https');

https.get('https://files.manuscdn.com/webapp/_next/static/chunks/2x8pix1ng4ex0.js', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    let pos = 0;
    while ((pos = d.indexOf('AddonShareService', pos)) !== -1) {
      console.log('Match at', pos);
      console.log(d.slice(Math.max(0, pos - 200), Math.min(d.length, pos + 300)));
      pos += 17;
    }
  });
});
