// INVESTIGATION 7: Deep probe TicketNew Next.js data routes for specific city data
// We found buildId and __NEXT_DATA__ - now find the city-specific movie listing API

const buildId = 'PG5bsPkEbSTO8eL6Hug-W';
const BASE = 'https://ticketnew.com';

// Their Redux state keys: currentlyRunningMovies, movieCities, cityCinemas
// These are loaded client-side. Let's look for their actual API backend

// Try the Redux thunk API endpoints they likely use
const API_ATTEMPTS = [
  // Common patterns for Next.js + Redux apps
  '/movies/api/currently-running?city=Coimbatore',
  '/movies/api/movies/currently-running?city=Coimbatore',
  '/movies/api/city-cinemas?city=Coimbatore',
  '/movies/api/movie-cities',
  // Check if they have a GraphQL endpoint
  '/graphql',
  '/api/graphql',
  // Data routes we haven't tried
  `/_next/data/${buildId}/movies/coimbatore.json`,
];

for (const path of API_ATTEMPTS) {
  try {
    const r = await fetch(`${BASE}${path}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'x-requested-with': 'XMLHttpRequest',
      },
      redirect: 'follow',
    });
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    console.log(`${path} -> ${r.status} | ct: ${ct.substring(0, 50)} | len: ${text.length}`);
    if (r.status === 200 && ct.includes('json')) {
      console.log('  JSON Preview:', text.substring(0, 400));
    }
  } catch (e) {
    console.log(`${path} -> ERROR: ${e.message}`);
  }
}

// Also look at the actual Redux action thunks loaded in the HTML
const cityPageRes = await fetch(`${BASE}/movies`, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  redirect: 'follow',
});
const html = await cityPageRes.text();

// Find API endpoint patterns in JS bundle references
const scriptMatches = html.match(/src="([^"]+\.js)"/g) || [];
console.log('\nJS bundles loaded:', scriptMatches.slice(0, 5));

// Look for any API base URL in the HTML
const apiMatches = html.match(/"(https?:\/\/[a-z0-9.-]+\/api[^"]{0,100})"/g) || [];
console.log('\nAPI URLs found in HTML:', apiMatches.slice(0, 10));

// Check runtimeConfig and publicRuntimeConfig
const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
if (nextDataMatch) {
  const data = JSON.parse(nextDataMatch[1]);
  console.log('\ninitialState keys:', Object.keys(data.props?.pageProps?.initialState || {}));
}
