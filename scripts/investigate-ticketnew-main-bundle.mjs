// Probe a larger TicketNew bundle (the main app chunk)
// First fetch the HTML to find the main app bundle

const homeHtml = await fetch('https://ticketnew.com/movies', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
}).then(r => r.text());

// Find all chunk URLs
const chunkUrls = [...homeHtml.matchAll(/src="(https:\/\/cdn\.district\.in\/ticketnew-web\/_next\/static\/chunks\/[^"]+\.js)"/g)]
  .map(m => m[1]);
console.log('All chunk URLs found:', chunkUrls.length);

// Find the largest chunk (most likely the app bundle)
let largestUrl = '';
let largestSize = 0;

for (const url of chunkUrls.slice(0, 10)) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://ticketnew.com/' },
    });
    const text = await r.text();
    console.log(`${url.split('/').pop()} -> ${text.length} bytes`);
    if (text.length > largestSize) {
      largestSize = text.length;
      largestUrl = url;
    }
  } catch (e) {
    console.log('Error:', url.split('/').pop(), e.message);
  }
}

console.log('\nLargest bundle:', largestUrl, largestSize, 'bytes');

// Now search the largest bundle for API patterns
if (largestUrl) {
  const text = await fetch(largestUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://ticketnew.com/' },
  }).then(r => r.text());
  
  // Extract all HTTP/HTTPS URLs
  const allUrls = [...new Set(text.match(/["'](https?:\/\/[^"'\\]{10,120})["']/g) || [])];
  console.log('\nAll URLs in largest bundle:');
  for (const u of allUrls.slice(0, 30)) {
    console.log(' ', u);
  }
}
