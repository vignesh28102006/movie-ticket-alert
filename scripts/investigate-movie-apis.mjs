// INVESTIGATION 2: Public movie data APIs for Indian cinema
// These are legitimate publicly documented APIs

const CANDIDATES = [
  // TMDB - The Movie Database (public API, free tier)
  { url: 'https://api.themoviedb.org/3/movie/now_playing?api_key=DEMO&language=en-IN&region=IN', name: 'TMDB Now Playing (India)' },
  // TMDB does NOT have showtimes/theatre data - just movie metadata
  // OMDB API
  { url: 'https://www.omdbapi.com/?t=paradise&apikey=DEMO', name: 'OMDB (metadata only)' },
  // Justickets - now defunct, was India-specific
  { url: 'https://api.justickets.in/', name: 'Justickets API' },
  // Paytm Movies / Insider (now part of PayTM) 
  { url: 'https://insider.in/', name: 'Insider.in (PayTM)' },
  // Atom Tickets
  { url: 'https://www.atomtickets.com/api/', name: 'Atom (US only)' },
  // Google Knowledge Graph for movies
  { url: 'https://kgsearch.googleapis.com/v1/entities:search?query=paradise+movie&types=Movie&key=DEMO', name: 'Google KG Search' },
  // Open Movie Data
  { url: 'https://www.googleapis.com/discovery/v1/apis?name=movies', name: 'Google APIs discovery (movies)' },
];

for (const { url, name } of CANDIDATES) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url.replace('DEMO', 'invalid_demo_key'), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
    console.log(`[${name}]`);
    console.log(`  URL: ${url}`);
    console.log(`  Status: ${res.status} | Length: ${text.length}`);
    console.log(`  Preview: ${text.substring(0, 200).replace(/\n/g, ' ')}`);
    console.log();
  } catch (e) {
    console.log(`[${name}] -> ERROR: ${e.message}\n`);
  }
}
