// Analyze the District 404 page deeply - it might still have useful data
async function analyzeDistrict404() {
  const url = 'https://www.district.in/movies/paradise-movie-tickets-coimbatore';
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  
  const html = await response.text();
  console.log('HTTP Status:', response.status);
  console.log('Note: 404 but page has content - check what the real 404 page vs active page looks like\n');

  // Check for "showtimes" to see if it's real data or just navbar
  const showtimeCount = (html.match(/showtime/gi) || []).length;
  const bookNowCount = (html.match(/Book Now/gi) || []).length;
  console.log('showtime occurrences:', showtimeCount);
  console.log('Book Now occurrences:', bookNowCount);
  
  // Extract JSON-LD data to see what's actually on the page
  const jsonLdMatches = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/gs);
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      const json = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '').trim();
      try {
        const data = JSON.parse(json);
        console.log('\nJSON-LD:', JSON.stringify(data, null, 2).substring(0, 500));
      } catch(e) {
        console.log('Invalid JSON-LD');
      }
    }
  }
  
  // Look for the 404 indicator in the HTML
  const has404Text = html.includes('Page not found') || html.includes('404') || html.includes('not found');
  console.log('\nHas 404 text indicator:', has404Text);
  
  // Find relevant section of HTML
  const showtimeIdx = html.indexOf('showtime');
  if (showtimeIdx > 0) {
    console.log('\nContext around "showtime":', html.slice(Math.max(0, showtimeIdx - 100), showtimeIdx + 200));
  }
}
analyzeDistrict404();
