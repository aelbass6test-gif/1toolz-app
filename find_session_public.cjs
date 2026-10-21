const fs = require('fs');
const https = require('https');

https.get('https://files.manuscdn.com/webapp/_next/static/chunks/2x8pix1ng4ex0.js', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    let pos = d.indexOf('SessionPublicService');
    console.log(d.slice(Math.max(0, pos - 100), Math.min(d.length, pos + 300)));
    // search for service definition
    let pos2 = d.indexOf('SessionPublicService', pos + 20);
    if (pos2 !== -1) {
      console.log('Second occurrence:');
      console.log(d.slice(Math.max(0, pos2 - 100), Math.min(d.length, pos2 + 300)));
    }
  });
});
