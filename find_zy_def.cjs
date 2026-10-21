const https = require('https');

https.get('https://files.manuscdn.com/webapp/_next/static/chunks/2x8pix1ng4ex0.js', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    let rx = /\bZY\s*=\s*/g;
    let m;
    while ((m = rx.exec(d)) !== null) {
      console.log('Found ZY definition at:', m.index);
      console.log(d.slice(Math.max(0, m.index - 50), Math.min(d.length, m.index + 300)));
    }
  });
});
