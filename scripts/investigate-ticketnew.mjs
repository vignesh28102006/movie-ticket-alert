// INVESTIGATION 5: TicketNew API - Indian platform, server-side accessible?
// TicketNew is a South India focused ticketing platform
// They have a public-facing website - check if they have an API or accessible JSON endpoints

const TICKETNEW_TESTS = [
  'https://www.ticketnew.com/Online-Movie/cinema-list/city/Coimbatore/',
  'https://www.ticketnew.com/api/movies?city=Coimbatore',
  'https://www.ticketnew.com/api/v1/movies/now-showing?city=coimbatore',
  'https://www.ticketnew.com/Online-Movie/online-booking/movie-detail/movie/Paradise/Coimbatore',
  // TicketNew has a city-specific movie listing
  'https://www.ticketnew.com/Movies/Coimbatore',
];

for (const url of TICKETNEW_TESTS) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
    const ct = res.headers.get('content-type') || '';
    const isJSON = ct.includes('json');
    
    console.log(`${url}`);
    console.log(`  Status: ${res.status} | Final: ${res.url}`);
    console.log(`  ContentType: ${ct}`);
    console.log(`  Length: ${text.length}`);
    
    if (isJSON) {
      console.log(`  JSON Preview: ${text.substring(0, 300)}`);
    } else {
      const hasMovies = text.includes('movie') || text.includes('Movie');
      const hasShowtime = text.includes('showtime') || text.includes('Showtime');
      const hasCoimbatore = text.toLowerCase().includes('coimbatore');
      const hasNextData = text.includes('__NEXT_DATA__');
      console.log(`  hasMovies: ${hasMovies} | hasShowtime: ${hasShowtime} | hasCBE: ${hasCoimbatore} | hasNextData: ${hasNextData}`);
    }
    console.log();
  } catch (e) {
    console.log(`${url} -> ERROR: ${e.message}\n`);
  }
}
