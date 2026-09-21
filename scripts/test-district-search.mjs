// Test the actual District movie slug format and search
async function testDistrictSearch() {
  // From real HTML: movie slugs use format "movie-name-movie-tickets-city"
  const tests = [
    'https://www.district.in/movies/paradise-movie-tickets-coimbatore',
    'https://www.district.in/movies/paradise-movie-tickets-chennai',
    'https://www.district.in/search?q=paradise',
  ];
  
  for (const url of tests) {
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
      console.log(`\n${url}`);
      console.log(`  Status: ${response.status}`);
      console.log(`  Final URL: ${response.url}`);
      console.log(`  Length: ${html.length}`);
      
      // Search for showtime or booking data
      const hasShowtimes = html.includes('showtime') || html.includes('show-time') || html.includes('Showtimes');
      const hasBookNow = html.includes('Book Now') || html.includes('Book Tickets') || html.includes('buy-tickets');
      const hasTheatreInfo = html.includes('theatre') || html.includes('cinema') || html.includes('multiplex');
      const hasJsonLd = html.includes('application/ld+json');
      
      console.log(`  Has showtimes: ${hasShowtimes}`);
      console.log(`  Has Book Now: ${hasBookNow}`);
      console.log(`  Has theatre info: ${hasTheatreInfo}`);
      console.log(`  Has JSON-LD: ${hasJsonLd}`);
      
      if (html.length > 1000 && html.length < 15000) {
        console.log(`  Content preview: ${html.substring(0, 400)}`);
      }
    } catch (err) {
      console.log(`${url} -> ERROR: ${err.message}`);
    }
  }
}
testDistrictSearch();
