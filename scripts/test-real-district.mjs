// Test what a REAL District movie page looks like vs the 404 page
// The 404 page has "showtime" in generic marketing text but NOT real show data
// Let's test with a known current movie that is listed on District
async function testRealDistrictMovie() {
  // From the home page scan, we saw these active movie slugs:
  const activeMovies = [
    'https://www.district.in/movies/hanuman-ansh-movie-tickets-',  // partial - needs city
    'https://www.district.in/movies/mirzapur-the-movie-movie-tickets-',
  ];
  
  // Try with cities
  const cities = ['hyderabad', 'mumbai', 'bangalore', 'delhi'];
  const results = [];
  
  for (const movie of activeMovies.slice(0, 1)) {
    for (const city of cities.slice(0, 2)) {
      const url = movie + city;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: controller.signal,
          redirect: 'follow',
        }).finally(() => clearTimeout(timeoutId));
        
        const html = await response.text();
        
        // Look for server-rendered booking data (not just footer text)
        // A real 200 page will have JSON data with shows, not just marketing text
        const has200Status = response.status === 200;
        const hasMovieData = html.includes('"startDate"') || html.includes('"screenName"') || html.includes('"EventReservation"');
        const hasServerData = html.includes('"offers"') || html.includes('"eventStatus"') || html.includes('"ScreeningEvent"');
        const has404indicator = html.includes('Page not found') || html.includes('Oops');
        
        console.log(`${url}`);
        console.log(`  Status: ${response.status}, Has real data: ${hasMovieData || hasServerData}, 404 indicator: ${has404indicator}`);
        console.log(`  HTML length: ${html.length}`);
        
        if (has200Status && !has404indicator) {
          results.push({ url, html });
        }
      } catch (err) {
        console.log(`${url} -> ERROR: ${err.message}`);
      }
    }
  }
  
  if (results.length > 0) {
    const { url, html } = results[0];
    console.log('\nFOUND ACTIVE PAGE:', url);
    // Extract JSON-LD for movie data
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    for (const match of jsonLdMatches) {
      const json = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '').trim();
      try {
        const data = JSON.parse(json);
        if (data['@type'] && data['@type'] !== 'WebSite' && data['@type'] !== 'Organization') {
          console.log('Movie JSON-LD:', JSON.stringify(data, null, 2).substring(0, 1000));
        }
      } catch(e) {}
    }
  } else {
    console.log('\nNo active pages found. District requires JS rendering or different slug format.');
  }
}
testRealDistrictMovie();
