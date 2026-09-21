// INVESTIGATION 6: Deep probe of TicketNew - the only Indian platform returning 200
// Check their __NEXT_DATA__ for API patterns, and probe known Next.js API routes

const BASE = 'https://ticketnew.com/movies';

// First get the home page and check __NEXT_DATA__
const homeRes = await fetch(`${BASE}`, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  },
  redirect: 'follow',
});
const homeHtml = await homeRes.text();
console.log('TicketNew home status:', homeRes.status, homeRes.url);
console.log('HTML length:', homeHtml.length);

// Extract __NEXT_DATA__
const nextMatch = homeHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
if (nextMatch) {
  const data = JSON.parse(nextMatch[1]);
  console.log('\n__NEXT_DATA__ top keys:', Object.keys(data));
  console.log('buildId:', data.buildId);
  if (data.props?.pageProps) {
    const pp = data.props.pageProps;
    console.log('pageProps keys:', Object.keys(pp));
    // Look for cities, movies, etc.
    if (pp.cities) console.log('Cities:', JSON.stringify(pp.cities).substring(0, 200));
    if (pp.movies) console.log('Movies (first 2):', JSON.stringify(pp.movies.slice(0,2)).substring(0, 400));
  }
  
  // Look for API routes in the build manifest
  if (data.runtimeConfig) console.log('runtimeConfig:', JSON.stringify(data.runtimeConfig));
}

// Try fetching the Next.js data routes directly
const buildId = nextMatch ? JSON.parse(nextMatch[1]).buildId : null;
console.log('\nBuild ID:', buildId);

if (buildId) {
  const DATA_ROUTES = [
    `/_next/data/${buildId}/index.json`,
    `/_next/data/${buildId}/movies/coimbatore.json`,
    `/_next/data/${buildId}/movies.json`,
  ];
  
  for (const route of DATA_ROUTES) {
    try {
      const r = await fetch(`https://ticketnew.com${route}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      const text = await r.text();
      console.log(`\n${route} -> ${r.status}, len=${text.length}`);
      if (r.status === 200) console.log('Preview:', text.substring(0, 400));
    } catch (e) {
      console.log(`${route} -> ERROR: ${e.message}`);
    }
  }
}

// Also probe internal API endpoints that Next.js apps typically expose
const API_ROUTES = [
  '/api/movies',
  '/api/movies/now-showing',
  '/api/cities',
  '/api/movies?city=Coimbatore',
  '/api/shows?city=Coimbatore&movie=Paradise',
];

for (const route of API_ROUTES) {
  try {
    const r = await fetch(`https://ticketnew.com${route}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    const text = await r.text();
    const ct = r.headers.get('content-type') || '';
    console.log(`\n${route} -> ${r.status}, ct=${ct}, len=${text.length}`);
    if (r.status === 200 && ct.includes('json')) console.log('JSON:', text.substring(0, 400));
  } catch (e) {
    console.log(`${route} -> ERROR: ${e.message}`);
  }
}
