const https = require('https');

https.get('https://manus.im/share/file/a712baa5-d8d3-442e-bb8a-3801d22f01ac', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Find all arabic text sequences
    const arabicMatches = d.match(/[\u0600-\u06FF0-9\s:،\.\-\–\(\)\/]{10,}/g) || [];
    console.log('Total arabic matches:', arabicMatches.length);
    console.log('Sample arabic text:', arabicMatches.slice(0, 30));
  });
});
