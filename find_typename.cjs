const https = require('https');

https.get('https://files.manuscdn.com/webapp/_next/static/chunks/2x8pix1ng4ex0.js', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // search for typeName or AddonShareService
    const rx = /typeName:\s*["']([^"']*AddonShareService[^"']*)["']/g;
    let m = rx.exec(d);
    console.log('Regex 1:', m);
    // search for "typeName:"
    const types = d.match(/typeName:\s*["'][^"']+["']/g) || [];
    console.log('Type names:', types.filter(t => t.toLowerCase().includes('share') || t.toLowerCase().includes('addon')));
  });
});
