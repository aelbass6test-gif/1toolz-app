const https = require('https');

https.get('https://manus.im/share/file/a712baa5-d8d3-442e-bb8a-3801d22f01ac', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Look for any string that looks like a markdown or report content or file title
    console.log('HTML size:', d.length);
    // Find script tags containing JSON
    const scripts = d.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    for (const s of scripts) {
      if (s.includes('تقرير') || s.includes('الموكل') || s.includes('عمولة')) {
        console.log('Script with Arabic found! Length:', s.length);
        // Find all arabic text sequences
        const arabicMatches = s.match(/[\u0600-\u06FF0-9\s:،\.\-\–\(\)\/]{10,}/g) || [];
        console.log('Sample arabic text:', arabicMatches.slice(0, 30));
      }
    }
  });
});
