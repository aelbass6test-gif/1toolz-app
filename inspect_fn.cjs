const fs = require('fs');
const https = require('https');

https.get('https://files.manuscdn.com/webapp/_next/static/chunks/2obynvxecpm9v.js', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    let idx = d.indexOf('e.initFileShare=async function');
    console.log(d.slice(Math.max(0, idx - 1500), idx + 200));
  });
});
