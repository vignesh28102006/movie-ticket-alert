// INVESTIGATION 4: Insider.in (same React app as District.in) + other Indian ticket platforms
// District.in == Insider.in (Zomato's platform)
// Also check: Paytm Movies, TicketNew, Cinemas nearby aggregators

const PLATFORMS = [
  // Insider.in is the same domain as district.in but alternate URL
  { url: 'https://insider.in/movies/coimbatore', name: 'Insider.in Coimbatore Movies' },
  // TicketNew
  { url: 'https://www.ticketnew.com/Online-Movie/cinema-list/city/Coimbatore/', name: 'TicketNew Coimbatore' },
  // PaytmMovies / Movies.paytm.com
  { url: 'https://movies.paytm.com/api/v1/movies?city=coimbatore', name: 'Paytm Movies API' },
  { url: 'https://movies.paytm.com/', name: 'Paytm Movies home' },
  // Cinemaxx India
  { url: 'https://www.cinemaxx.in/', name: 'Cinemaxx India' },
  // Kyazoonga
  { url: 'https://www.kyazoonga.com/', name: 'Kyazoonga' },
  // Movy - Indian cinema aggregator
  { url: 'https://in.movy.com/', name: 'Movy India' },
  // JioCinema (streaming, not theatres)
];

for (const { url, name } of PLATFORMS) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
    
    // Key signals
    const isJSON = res.headers.get('content-type')?.includes('json');
    const hasMovieData = isJSON ? (text.includes('title') && text.includes('movie')) : false;
    const hasShowtimes = text.includes('showtime') || text.includes('Showtimes') || text.includes('show-time');
    const hasBookNow = text.includes('Book Now') || text.includes('Buy Tickets') || text.includes('book-now');
    const hasCloudflare = text.includes('Cloudflare') || res.status === 403;
    const hasCaptcha = text.includes('captcha') || text.includes('CAPTCHA') || text.includes('challenge');
    
    console.log(`[${name}]`);
    console.log(`  Status: ${res.status} | Final: ${res.url} | Length: ${text.length}`);
    console.log(`  JSON: ${isJSON} | Showtimes: ${hasShowtimes} | Book Now: ${hasBookNow}`);
    console.log(`  Cloudflare: ${hasCloudflare} | CAPTCHA: ${hasCaptcha}`);
    if (isJSON && text.length < 500) console.log(`  Content: ${text}`);
    console.log();
  } catch (e) {
    console.log(`[${name}] -> ERROR: ${e.message}\n`);
  }
}
