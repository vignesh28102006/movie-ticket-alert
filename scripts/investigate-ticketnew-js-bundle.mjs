// KEY DISCOVERY: TicketNew bundles are hosted at cdn.district.in/ticketnew-web/
// This means TicketNew IS OWNED BY DISTRICT/ZOMATO!
// The JS bundles should contain the API base URL

// Let's download one of the JS chunks and look for API patterns
const CHUNK_URL = 'https://cdn.district.in/ticketnew-web/_next/static/chunks/441p0qgf1a-ej.js';

try {
  const res = await fetch(CHUNK_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://ticketnew.com/',
    },
  });
  const text = await res.text();
  console.log('Chunk status:', res.status, '| Length:', text.length);
  
  // Look for API base URL, API_URL, baseURL patterns
  const apiPatterns = text.match(/(https?:\/\/[a-z0-9.-]+(?:\/api)?[^"'\s]{0,100})/g) || [];
  const uniqueUrls = [...new Set(apiPatterns)];
  console.log('\nURLs found in JS bundle:');
  for (const url of uniqueUrls.slice(0, 30)) {
    if (!url.includes('cdn.') && !url.includes('analytics') && !url.includes('static')) {
      console.log(' ', url);
    }
  }
  
  // Look for apiKey, API_KEY, apiBaseUrl patterns
  const keyPatterns = text.match(/(?:apiKey|API_KEY|apiBase|baseUrl|BASE_URL|endpoint)["\s:=]+["']([^"']{5,100})["']/g) || [];
  console.log('\nAPI key/endpoint patterns:');
  for (const p of keyPatterns.slice(0, 10)) {
    console.log(' ', p.substring(0, 100));
  }
  
  // Look for CORS or host patterns
  const hostPatterns = text.match(/["']([a-z0-9-]+\.(?:ticketnew|district|zomato|insider)\.(?:in|com)[^"']{0,50})["']/g) || [];
  console.log('\nDomain patterns:');
  for (const p of new Set(hostPatterns)) {
    console.log(' ', p.substring(0, 100));
  }

} catch (e) {
  console.log('Error:', e.message);
}
