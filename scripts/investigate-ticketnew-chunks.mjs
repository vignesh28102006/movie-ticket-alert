// The internal .mesh hosts are not publicly routable.
// Let's look at the SECOND largest bundle for more API context
// and also look at the most important chunk: 41e6-otdg16ql.js (210K - likely the movies module)

const CHUNK_URLS = [
  'https://cdn.district.in/ticketnew-web/_next/static/chunks/41e6-otdg16ql.js',
  'https://cdn.district.in/ticketnew-web/_next/static/chunks/0y2e4eauahyyk.js',
  'https://cdn.district.in/ticketnew-web/_next/static/chunks/45671znofo_bp.js',
];

for (const url of CHUNK_URLS) {
  try {
    const text = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://ticketnew.com/' },
    }).then(r => r.text());
    
    const filename = url.split('/').pop();
    console.log(`\n=== ${filename} (${text.length} bytes) ===`);
    
    // Look for mesh endpoints with full paths
    const meshPaths = [...text.matchAll(/["'](http:\/\/district-movies-[^"']+)["']/g)].map(m => m[1]);
    if (meshPaths.length) {
      console.log('Internal mesh endpoints:');
      for (const p of new Set(meshPaths)) console.log(' ', p);
    }
    
    // Look for public API patterns
    const publicApis = [...text.matchAll(/["'](https:\/\/(?:api|gateway|movies|backend)[^"']+)["']/g)].map(m => m[1]);
    if (publicApis.length) {
      console.log('Public API endpoints:');
      for (const p of new Set(publicApis)) console.log(' ', p);
    }
    
    // Look for environment variable patterns
    const envVars = [...text.matchAll(/(?:process\.env\.|NEXT_PUBLIC_)([A-Z_]+)/g)].map(m => m[1]);
    if (envVars.length) {
      console.log('Env vars:', [...new Set(envVars)].slice(0, 10).join(', '));
    }
    
    // Look for city codes
    const cityRefs = [...text.matchAll(/"(?:coimbatore|CBE|COIMBATORE|cbe)"/gi)].map(m => m[0]);
    if (cityRefs.length) {
      console.log('City references found:', cityRefs.slice(0, 5).join(', '));
      const idx = text.toLowerCase().indexOf('coimbatore');
      if (idx > 0) console.log('Coimbatore context:', text.slice(Math.max(0, idx-50), idx+100));
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}
