// CRITICAL DISCOVERY from JS bundle:
// Internal API hosts:
// - https://api.edition.in  (public-facing API gateway?)
// - http://district-movies-transactions.mesh  (internal mesh, not routable publicly)
// - http://district-movies-search.mesh  (internal mesh)
// - http://district-movies-content.mesh/v3/movies/upcoming  (internal mesh)
//
// Let's test what's accessible from api.edition.in (public API gateway)

const API_BASE = 'https://api.edition.in';

const ENDPOINTS = [
  '/v1/movies/now-showing',
  '/v1/movies/now-showing?city=coimbatore',
  '/v3/movies/upcoming',
  '/v3/movies/now-showing',
  '/v3/movies?city=coimbatore',
  '/v2/movies/coimbatore',
  '/movies',
  '/movies/coimbatore',
  '/shows',
  '/shows?movie=paradise&city=coimbatore',
  '/cinemas?city=coimbatore',
  '/v1/cities',
  '/v1/movies',
];

for (const ep of ENDPOINTS) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);
    const r = await fetch(`${API_BASE}${ep}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*',
        'Origin': 'https://ticketnew.com',
        'Referer': 'https://ticketnew.com/',
      },
      signal: controller.signal,
    });
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    console.log(`${ep} -> ${r.status} | ${ct.substring(0, 40)} | ${text.length} bytes`);
    if (r.status === 200 && ct.includes('json')) {
      console.log('  JSON:', text.substring(0, 300));
    } else if (r.status === 200 && text.length < 200) {
      console.log('  Body:', text);
    }
  } catch (e) {
    console.log(`${ep} -> ERROR: ${e.message}`);
  }
}
