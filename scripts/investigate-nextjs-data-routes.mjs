// The internal mesh endpoints are not routable. Let's try a completely different approach.
// Check the District/TicketNew NEXT.js _next/data endpoint for a valid city page
// We know their slug format for movies - let's find valid city slugs used in routing

const buildId = 'PG5bsPkEbSTO8eL6Hug-W';

// Attempt various city route patterns
const CITY_ATTEMPTS = [
  `/_next/data/${buildId}/movies/coimbatore.json`,
  `/_next/data/${buildId}/movies/chennai.json`, 
  `/_next/data/${buildId}/movies/mumbai.json`,
  `/_next/data/${buildId}/movies/hyderabad.json`,
  `/_next/data/${buildId}/movies/bangalore.json`,
];

for (const path of CITY_ATTEMPTS) {
  const r = await fetch(`https://ticketnew.com${path}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
  });
  const text = await r.text();
  console.log(`${path.split('/').pop()} -> ${r.status} | ${text.length} bytes`);
  if (r.status === 200 && text.includes('{')) {
    try {
      const data = JSON.parse(text);
      console.log('  keys:', Object.keys(data.pageProps?.data || data.pageProps || {}));
      console.log('  Preview:', text.substring(0, 300));
    } catch(e) {}
  }
}

// Also test the district.in _next/data routes
const DISTRICT_DATA = [
  `https://www.district.in/_next/data/${buildId}/movies/coimbatore.json`,
  `https://www.district.in/_next/data/${buildId}/movies/paradise-movie-tickets-coimbatore.json`,
];

console.log('\n--- district.in data routes ---');
for (const url of DISTRICT_DATA) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const text = await r.text();
    console.log(`${url.split('/').pop()} -> ${r.status} | ${text.length} bytes`);
  } catch(e) {
    console.log(`Error: ${e.message}`);
  }
}
